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
export function findRecipeNode(parsed: unknown): unknown | null {
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

const tidy = (text: string): string =>
  text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

interface Article {
  text: string;
  /**
   * False when Readability found no article and we fell back to raw body
   * text. On an SPA shell that fallback is navigation chrome, not content —
   * so the caller must not trust its length as a measure of prose.
   */
  fromReadability: boolean;
}

function readArticle(doc: Document): Article {
  let text = "";
  try {
    // Readability mutates the document it parses, so hand it a clone.
    text = new Readability(doc.cloneNode(true) as Document).parse()?.textContent ?? "";
  } catch {
    // Readability throws on pages it can't make sense of — fall back to raw text.
  }
  if (text.trim()) return { text: tidy(text), fromReadability: true };
  return { text: tidy(doc.body?.textContent ?? ""), fromReadability: false };
}

/**
 * Platforms whose pages are app shells rather than documents.
 *
 * Readability often *succeeds* on these — it latches onto a sidebar or a
 * comment column and returns a confident-looking block of navigation. So the
 * shell cannot be detected by asking whether parsing worked, or by measuring
 * length; both are satisfied by chrome. The host is the reliable signal, and
 * these are the platforms the product exists to handle.
 */
const SOCIAL_VIDEO_HOSTS =
  /(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|threads\.net|x\.com|twitter\.com)$/;

function isSocialVideo(url: string): boolean {
  try {
    return SOCIAL_VIDEO_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * The post caption, as the page advertises it to link previews.
 *
 * This is the only reliable way to read an Instagram or TikTok caption: the
 * page is a React shell whose DOM classes are generated, but og:description
 * is populated with the caption text — which on a Reel *is* the recipe.
 */
function readCaption(doc: Document): string {
  const sources = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ];
  for (const selector of sources) {
    const content = doc.querySelector(selector)?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return "";
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
  const caption = readCaption(doc);

  // On a social video host the body text is chrome, however well it parses.
  // Sending it costs thousands of tokens of menu items and buries the recipe;
  // the caption is the content, and the captured frames carry the rest.
  const shell = isSocialVideo(url) || !article.fromReadability;

  if (hasVideo) {
    if (caption && (shell || article.text.length < CAPTION_CEILING)) {
      return { via: "caption only", text: caption.slice(0, TEXT_CAP), source: url, title, hasVideo };
    }
    // No caption to fall back on: still flag it as a caption-grade source so
    // the model is not told to expect an article.
    if (article.text.length < CAPTION_CEILING) {
      return {
        via: "caption only",
        text: article.text.slice(0, TEXT_CAP),
        source: url,
        title,
        hasVideo,
      };
    }
  }

  return { via: "article text", text: article.text.slice(0, TEXT_CAP), source: url, title, hasVideo };
}
