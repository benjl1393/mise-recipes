import { JSON_LD_SELECTOR, findRecipeNode } from "./page-source";

/**
 * Is this page *declaring* itself a recipe?
 *
 * Deliberately narrow. This drives the toolbar pulse, which is an attention
 * claim on the user — a false pulse costs more than a missed one, because an
 * icon that cries recipe on every page is an icon you learn to ignore. So the
 * only signals accepted are ones a publisher set on purpose: schema.org Recipe
 * in JSON-LD, or the same type in microdata.
 *
 * Notably absent: the caption and video heuristics `pickSource` uses for Reels
 * and TikTok. Those are the right call *after* the user has decided this is a
 * recipe and pressed Fire; they are far too loose to decide it on their behalf.
 */

const MICRODATA_SELECTOR = '[itemtype]';
const RECIPE_TYPE = /schema\.org\/Recipe\b/i;

function hasJsonLdRecipe(doc: Document): boolean {
  for (const script of Array.from(doc.querySelectorAll(JSON_LD_SELECTOR))) {
    try {
      if (findRecipeNode(JSON.parse(script.textContent ?? ""))) return true;
    } catch {
      // A malformed ld+json block is common in the wild — skip it, try the next.
    }
  }
  return false;
}

function hasMicrodataRecipe(doc: Document): boolean {
  return Array.from(doc.querySelectorAll(MICRODATA_SELECTOR)).some((node) =>
    RECIPE_TYPE.test(node.getAttribute("itemtype") ?? ""),
  );
}

export function hasRecipe(doc: Document): boolean {
  return hasJsonLdRecipe(doc) || hasMicrodataRecipe(doc);
}
