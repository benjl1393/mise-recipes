import Anthropic from "@anthropic-ai/sdk";
import { Recipe, UnitPreference } from "./types";

const MAX_TEXT_LENGTH = 50_000;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

export function buildSystemPrompt(units: UnitPreference): string {
  return `You are a recipe extraction assistant. Extract the recipe from the provided content and return it as JSON.

All measurements must be in ${units} units. Convert if necessary.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "title": "string",
  "servings": "string or null",
  "prepTime": "string or null",
  "cookTime": "string or null",
  "ingredients": ["string"],
  "steps": ["string"],
  "notes": ["string"]
}

Rules:
- If a field cannot be determined, set it to null (or empty array for ingredients/steps/notes)
- Steps should be clear, concise imperative sentences
- Ingredients should include quantities and units
- Notes should capture any useful tips, substitutions, or storage instructions
- Do not invent information not present in the source`;
}

export function buildUserPrompt(text: string): string {
  const truncated =
    text.length > MAX_TEXT_LENGTH
      ? text.slice(0, MAX_TEXT_LENGTH)
      : text;
  return `Extract the recipe from the following content:\n\n${truncated}`;
}

export async function parseRecipeFromText(
  text: string,
  units: UnitPreference
): Promise<Recipe> {
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: buildSystemPrompt(units),
    messages: [{ role: "user", content: buildUserPrompt(text) }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return JSON.parse(content.text) as Recipe;
}

export async function parseRecipeFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  units: UnitPreference
): Promise<Recipe> {
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: buildSystemPrompt(units),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "Extract the recipe from this image.",
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return JSON.parse(content.text) as Recipe;
}
