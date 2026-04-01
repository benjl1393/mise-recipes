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
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeArchiver/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The site took too long to respond. Try again, or paste the recipe text instead.");
    }
    throw new Error("Couldn't reach that site. Check the URL and try again.");
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw new Error("This site blocked automatic access. Try copying the recipe text from the page and pasting it instead.");
    }
    if (response.status === 404) {
      throw new Error("Page not found. The recipe may have been moved or deleted.");
    }
    if (response.status >= 500) {
      throw new Error("That site seems to be having issues right now. Try again later, or paste the recipe text instead.");
    }
    throw new Error(`Failed to fetch URL (${response.status}). Try pasting the recipe text instead.`);
  }

  const html = await response.text();
  return extractFromHtml(html);
}
