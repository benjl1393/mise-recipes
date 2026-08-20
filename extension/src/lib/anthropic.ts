import Anthropic from "@anthropic-ai/sdk";
import { normalizeTags, TAXONOMY } from "./tags";
import type { ExtractionPayload } from "./page-source";
import type { Recipe, Units } from "./types";

/** The page has no recipe on it — the Off Menu state, not a failure. */
export class OffMenuError extends Error {
  constructor() {
    super("No recipe on this page.");
    this.name = "OffMenuError";
  }
}

/**
 * Structured-output schema. `found` lets the model say "no recipe here"
 * without inventing one — the Off Menu state depends on it.
 */
export const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "title", "serves", "ingredients", "method", "tags"],
  properties: {
    found: { type: "boolean", description: "False if the page carries no recipe." },
    title: {
      type: "string",
      description: "Normal case, one line, no trailing punctuation.",
    },
    subtitle: {
      type: "string",
      description: "One-line description. Omit if the source gives none.",
    },
    author: {
      type: "string",
      description:
        "Who wrote the recipe, as the source credits them. Omit if unattributed.",
    },
    serves: { type: "string", description: 'e.g. "4", "makes 12", "serves 6-8".' },
    hands_on: {
      type: "string",
      description: 'Active time at the counter, e.g. "25m". Excludes passive waits.',
    },
    total: {
      type: "string",
      description: 'Total elapsed time including passive waits, e.g. "2h 10m".',
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["qty", "item"],
        properties: {
          qty: {
            type: "string",
            description:
              'Number and unit, space-separated ("800 g"). Em-dash "—" if unmeasured.',
          },
          item: { type: "string", description: "Lowercase prose with brief modifiers." },
        },
      },
    },
    method: {
      type: "array",
      items: { type: "string" },
      description: "Flat prose steps, no sub-bullets.",
    },
    notes: {
      type: "array",
      items: { type: "string" },
      description: "Only genuine extra context. Omit rather than pad.",
    },
    tags: { type: "array", items: { type: "string" } },
  },
} as const;

export function buildPrompt(payload: ExtractionPayload, units: Units): string {
  const temperature = units === "metric" ? "°C" : "°F";
  const kind =
    payload.via === "schema data" ? "schema.org/Recipe JSON" : "page content";

  return `Extract the recipe from this ${kind}.

SOURCE: ${payload.source}
PAGE TITLE: ${payload.title}

Rules:
- Output ${units} units throughout, temperatures in ${temperature}.
- Convert by ingredient density, not naive math: "⅓ cup" becomes "80 ml", "1 cup flour" becomes "125 g flour" (weight is preferred for baking). Round to culturally natural increments — use vulgar fractions (½, ⅓, ¼, ¾) rather than decimals where a cook would.
- Quantities put a space between number and unit. Abbreviate MEASUREMENT units to their short form — g, kg, ml, l, tbsp, tsp, oz, lb, cup — even when the source spells them out: write "3 tbsp", never "3 tablespoons".
- Countable and descriptive units belong in the quantity and keep their word: "4 cloves" + "garlic, crushed", "1 thumb" + "ginger, julienned", "2 sprigs", "1 can". Never push these into the item.
- Use vulgar fractions (½ ⅓ ¼ ⅔ ¾) rather than decimals. Write "1½ tbsp", never "1.5 tbsp". Do not normalise the source's own style — normalise to this one.
- Use the em-dash "—" as the quantity for finishing garnishes with no measurable amount.
- Ingredient items are lowercase prose; brief modifiers like "crushed" or "skin-on" are welcome.
- Method steps are flat prose. If the source nests sub-steps, flatten them into one paragraph with em-dashes or semicolons.
- Author is the recipe's credited writer — a byline, "Recipe by X", a chef or blog author. Use the name as written, without titles or affiliations. Omit the field if the source names nobody; never infer it from the site or channel name.
- Notes are only for genuine extra context — substitutions, source tips, provenance. Omit the field rather than padding it.
- Give 3–5 tags from this taxonomy: cuisine ${TAXONOMY.cuisine}; main ingredient ${TAXONOMY.ingredient}; technique ${TAXONOMY.technique}; dietary ${TAXONOMY.dietary}. Do not add time-bucket tags — those are computed.
- If this page carries no recipe, set found to false and leave the other fields empty. Never invent a recipe.

CONTENT:
${payload.text}`;
}

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
