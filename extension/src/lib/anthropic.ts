import Anthropic from "@anthropic-ai/sdk";
import { normalizeTags } from "./tags";
import { buildPrompt, OffMenuError, RECIPE_SCHEMA } from "./extract";
import type { ExtractionPayload } from "./page-source";
import type { Recipe, Units } from "./types";

export { buildPrompt, OffMenuError, RECIPE_SCHEMA };

export interface ExtractOptions {
  client: Anthropic;
  units: Units;
  model: string;
  /** Base64 JPEG frames, already downsampled to <=1568px on the long edge. */
  frames?: string[];
}

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    // The popup is a browser context; the API blocks browser origins unless
    // the caller opts in explicitly. BYOK means the key never leaves the device.
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
  });
}

export async function extractRecipe(
  payload: ExtractionPayload,
  { client, units, model, frames = [] }: ExtractOptions,
): Promise<Recipe> {
  const content = [
    ...frames.map((data) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
    })),
    { type: "text" as const, text: buildPrompt(payload, units) },
  ];

  // Haiku 4.5 supports structured outputs and vision, but not `effort` or
  // adaptive thinking — sending either is a 400.
  const response = await client.messages.parse({
    model,
    max_tokens: 8000,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
  } as never);

  const parsed = (response as { parsed_output?: (Recipe & { found: boolean }) | null })
    .parsed_output;

  if (!parsed) throw new Error("Claude returned no structured output.");
  if (!parsed.found || parsed.ingredients.length === 0) throw new OffMenuError();

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    author: parsed.author,
    serves: parsed.serves,
    hands_on: parsed.hands_on,
    total: parsed.total,
    ingredients: parsed.ingredients,
    method: parsed.method,
    notes: parsed.notes,
    tags: normalizeTags(parsed.tags, parsed.hands_on),
  };
}
