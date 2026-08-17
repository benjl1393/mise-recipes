import { Readability } from "@mozilla/readability";
import type { ViaMethod } from "./types";

export const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

/** Below this, prose is a caption rather than an article. */
const CAPTION_CEILING = 400;

/** Claude gets plenty of signal well before a full long-form blog. */
const TEXT_CAP = 24_000;

export interface ExtractionPayload {
  via: ViaMethod;
  text: string;
  source: string;
  title: string;
  hasVideo: boolean;
}

function isRecipeNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const type = (node as { "@type"?: unknown })["@type"];
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

/** Walk a JSON-LD document (bare object, array, or @graph) for a Recipe node. */
function findRecipeNode(parsed: unknown): unknown | null {
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const hit = findRecipeNode(entry);
      if (hit) return hit;
    }
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (isRecipeNode(parsed)) return parsed;
  const graph = (parsed as { "@graph"?: unknown })["@graph"];
  return graph ? findRecipeNode(graph) : null;
}

function readJsonLdRecipe(doc: Document): string | null {
  for (const script of Array.from(doc.querySelectorAll(JSON_LD_SELECTOR))) {
    try {
      const node = findRecipeNode(JSON.parse(script.textContent ?? ""));
      if (node) return JSON.stringify(node);
    } catch {
      // A malformed ld+json block is common in the wild — skip it, try the next.
    }
  }
  return null;
}

function readArticle(doc: Document): string {
  let text = "";
  try {
    // Readability mutates the document it parses, so hand it a clone.
    text = new Readability(doc.cloneNode(true) as Document).parse()?.textContent ?? "";
  } catch {
    // Readability throws on pages it can't make sense of — fall back to raw text.
  }
  if (!text) text = doc.body?.textContent ?? "";
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function pickSource(doc: Document, url: string): ExtractionPayload {
  const title = doc.title ?? "";
  const hasVideo = doc.querySelector("video") !== null;

  const schema = readJsonLdRecipe(doc);
  if (schema) {
    return {
      via: "schema data",
      text: schema.slice(0, TEXT_CAP),
      source: url,
      title,
      hasVideo,
    };
  }

  const article = readArticle(doc);
  const via: ViaMethod =
    hasVideo && article.length < CAPTION_CEILING ? "caption only" : "article text";

  return { via, text: article.slice(0, TEXT_CAP), source: url, title, hasVideo };
}
