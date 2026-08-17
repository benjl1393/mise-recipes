import { formatCaptured, formatTicket, serializeRecipe } from "./markdown";
import { saveTicket } from "./storage";
import type { Frontmatter, Recipe } from "./types";

const MAX_FILENAME = 80;

export function filenameFor(recipe: Recipe, fm: Frontmatter): string {
  const prefix = formatTicket(fm.ticket);
  const budget = MAX_FILENAME - prefix.length - "-.md".length;
  const slug = recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, budget)
    .replace(/-$/, "");
  return slug ? `${prefix}-${slug}.md` : `${prefix}.md`;
}

/**
 * Write the .md to disk, then record the ticket on The Pass.
 *
 * Order matters: a ticket on The Pass claims a file exists on disk, so the
 * download has to succeed first.
 */
export async function fire(recipe: Recipe, fm: Frontmatter): Promise<void> {
  const markdown = serializeRecipe(recipe, fm);
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  try {
    await chrome.downloads.download({
      url,
      filename: filenameFor(recipe, fm),
      saveAs: false,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  await saveTicket({
    frontmatter: { ...fm, captured: formatCaptured(fm.captured) },
    recipe,
  });
}
