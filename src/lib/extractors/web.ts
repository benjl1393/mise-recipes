import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

interface JsonLdRecipe {
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text: string }>;
  recipeYield?: string;
  prepTime?: string;
  cookTime?: string;
  description?: string;
}

interface WebExtraction {
  jsonLd: JsonLdRecipe | null;
  textContent: string;
}

export function extractFromHtml(html: string): WebExtraction {
  const jsonLd = extractJsonLd(html);
  const textContent = extractReadableText(html);
  return { jsonLd, textContent };
}

function extractJsonLd(html: string): JsonLdRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() ?? "");
      if (data["@type"] === "Recipe") return data;
      if (Array.isArray(data["@graph"])) {
        const recipe = data["@graph"].find(
          (item: { "@type"?: string }) => item["@type"] === "Recipe"
        );
        if (recipe) return recipe;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractReadableText(html: string): string {
  const { document } = parseHTML(html);
  const reader = new Readability(document);
  const article = reader.parse();
  return article?.textContent?.trim() ?? "";
}

export async function fetchAndExtract(url: string): Promise<WebExtraction> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RecipeArchiver/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  return extractFromHtml(html);
}
