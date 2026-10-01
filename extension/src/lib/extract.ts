import { normalizeTags, TAXONOMY } from "./tags";
import type { ExtractionPayload } from "./page-source";
import type { Recipe, Units } from "./types";
import { callAnthropic, type AnthropicLike } from "./providers/anthropic";
import { contextOf, type Connection, type ModelRequest } from "./providers/connection";
import { ProviderError, type ErrorContext } from "./providers/errors";
import { callOpenAICompat } from "./providers/openai-compat";

/**
 * The vendor-independent half of extraction: the schema, the prompt, and the
 * checks that run on whatever a vendor sends back. Nothing here knows which
 * vendor it is talking to.
 */

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

/** A JSON Schema node, as far as this module walks it. */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  [keyword: string]: unknown;
}

/**
 * The schema the Chat Completions path sends. OpenAI's strict mode requires
 * every property in `required`, with optional ones expressed as nullable;
 * Gemini and xAI accept the same. The Anthropic path keeps RECIPE_SCHEMA.
 */
export function toNullableSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...schema };
  if (schema.properties) {
    const required = new Set(schema.required ?? []);
    const properties: Record<string, JsonSchema> = {};
    for (const [name, prop] of Object.entries(schema.properties)) {
      const rewritten = toNullableSchema(prop);
      properties[name] = required.has(name)
        ? rewritten
        : { ...rewritten, type: [rewritten.type as string, "null"] };
    }
    out.properties = properties;
    out.required = Object.keys(schema.properties);
  }
  if (schema.items) out.items = toNullableSchema(schema.items);
  return out;
}

export type ParsedRecipe = Omit<Recipe, "tags"> & { found: boolean; tags: string[] };

/**
 * Claude's structured output is guaranteed to match the schema; not every
 * OpenAI-compatible vendor makes that promise. Check the shape before it
 * reaches the card, and turn strict mode's nulls back into absent fields.
 */
export function validateOutput(raw: unknown, ctx: ErrorContext): ParsedRecipe {
  const fail = (detail: string) => new ProviderError("malformed", ctx, { detail });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw fail("reply is not an object");
  const o = raw as Record<string, unknown>;
  if (typeof o.found !== "boolean") throw fail("found is not true or false");
  if (!o.found) {
    return { found: false, title: "", serves: "", ingredients: [], method: [], tags: [] };
  }

  const str = (key: string): string => {
    if (typeof o[key] !== "string") throw fail(`${key} is not text`);
    return o[key] as string;
  };
  const optStr = (key: string): string | undefined => {
    const v = o[key];
    if (v === null || v === undefined) return undefined;
    if (typeof v !== "string") throw fail(`${key} is not text`);
    return v;
  };
  const strList = (key: string): string[] => {
    const v = o[key];
    if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) {
      throw fail(`${key} is not a list of text`);
    }
    return v as string[];
  };
  const optStrList = (key: string): string[] | undefined =>
    o[key] === null || o[key] === undefined ? undefined : strList(key);

  const ingredients = o.ingredients;
  if (
    !Array.isArray(ingredients) ||
    !ingredients.every(
      (i) => i && typeof i === "object" && typeof i.qty === "string" && typeof i.item === "string",
    )
  ) {
    throw fail("ingredients are not qty/item pairs");
  }

  return {
    found: true,
    title: str("title"),
    subtitle: optStr("subtitle"),
    author: optStr("author"),
    serves: str("serves"),
    hands_on: optStr("hands_on"),
    total: optStr("total"),
    ingredients: ingredients.map((i: { qty: string; item: string }) => ({
      qty: i.qty,
      item: i.item,
    })),
    method: strList("method"),
    notes: optStrList("notes"),
    tags: strList("tags"),
  };
}

/**
 * Evenly spaced, first and last kept, order preserved. Mistral takes at most
 * 8 images, so a 24-frame Reel has to be thinned rather than cut off.
 */
export function sampleFrames<T>(frames: T[], max: number): T[] {
  if (frames.length <= max) return frames;
  if (max <= 0) return [];
  if (max === 1) return [frames[Math.floor((frames.length - 1) / 2)]!];
  return Array.from(
    { length: max },
    (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]!,
  );
}

const MAX_TOKENS = 8000;

export interface ExtractOptions {
  connection: Connection;
  units: Units;
  /** Base64 JPEG frames, already downsampled to <=1568px on the long edge. */
  frames?: string[];
  /** Test seams only. */
  transport?: { fetch?: typeof fetch; anthropic?: AnthropicLike };
}

export async function extractRecipe(
  payload: ExtractionPayload,
  { connection, units, frames = [], transport = {} }: ExtractOptions,
): Promise<Recipe> {
  const request: ModelRequest = {
    prompt: buildPrompt(payload, units),
    frames: sampleFrames(frames, connection.maxImages),
    schema:
      connection.protocol === "anthropic"
        ? RECIPE_SCHEMA
        : toNullableSchema(RECIPE_SCHEMA as unknown as JsonSchema),
    maxTokens: MAX_TOKENS,
  };

  const raw =
    connection.protocol === "anthropic"
      ? await callAnthropic(connection, request, transport.anthropic)
      : await callOpenAICompat(connection, request, transport.fetch);

  const parsed = validateOutput(raw, contextOf(connection));
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
