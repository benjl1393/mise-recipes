import type { Frontmatter, Recipe } from "./types";

/**
 * Ingredient separator: two spaces, middle-dot (U+00B7), two spaces. Five
 * characters — it doubles as the qty/item column gutter in mono renderings.
 */
export const SEPARATOR = "  ·  ";

/**
 * Tag-line separator: single spaces. Narrower than the ingredient separator
 * because the tag line is an inline run, not an aligned column.
 */
export const TAG_SEPARATOR = " · ";

/** Brand signature: glyph U+2736, one space, mise.app. */
export const FOOTER = "✶ mise.app";

export function formatTicket(n: number): string {
  return String(n).padStart(5, "0");
}

/** ISO 8601 to the minute in local time — "2026-04-22T16:28". */
export function formatCaptured(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

/**
 * `captured` as YAML sees it: seconds AND a UTC offset. Both are load-bearing.
 *
 * Obsidian parses frontmatter with js-yaml, and the minute-precision form
 * `2026-04-22T16:28` misses the YAML timestamp pattern entirely — it types as
 * Text, so the Properties panel will not treat it as a date and it will not
 * sort or filter in Bases or Dataview.
 *
 * Adding seconds alone fixes the type and introduces a worse bug: a bare
 * `2026-04-22T16:28:00` is read as **UTC**, so a recipe captured at 16:28 in
 * Zurich renders as 18:28. A wrong time that looks right beats no date only
 * from the parser's point of view. The offset is what makes it round-trip.
 *
 * Verified against js-yaml 4.1.1, the engine behind Obsidian's `parseYaml`.
 */
export function formatCapturedYaml(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${formatCaptured(d)}:${p(d.getSeconds())}` +
    `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}

export function serializeRecipe(recipe: Recipe, fm: Frontmatter): string {
  const lines: string[] = [];

  // 1–3: frontmatter, in the spec's mandatory field order.
  lines.push("---");
  // Quoted: unquoted `00427` is a YAML integer, so Obsidian's Properties
  // panel renders the ticket as `427` and the zero-padding that carries the
  // whole ticket-printer identity is gone before the user ever sees it.
  lines.push(`ticket: "${formatTicket(fm.ticket)}"`);
  lines.push(`captured: ${formatCapturedYaml(fm.captured)}`);
  lines.push(`source: ${fm.source}`);
  lines.push(`via: ${fm.via}`);
  if (recipe.author) lines.push(`author: ${recipe.author}`);
  lines.push(`serves: ${recipe.serves}`);
  if (recipe.hands_on) lines.push(`hands_on: ${recipe.hands_on}`);
  if (recipe.total) lines.push(`total: ${recipe.total}`);
  if (fm.units) lines.push(`units: ${fm.units}`);
  if (fm.scaled !== undefined) lines.push(`scaled: ${fm.scaled}`);
  lines.push("---");

  // 4–8: title, optional subtitle.
  lines.push("");
  lines.push(`# ${recipe.title}`);
  if (recipe.subtitle) {
    lines.push("");
    lines.push(`*${recipe.subtitle}*`);
  }

  // 9–11: ingredients.
  lines.push("");
  lines.push("## Ingredients");
  for (const { qty, item } of recipe.ingredients) {
    lines.push(`- ${qty}${SEPARATOR}${item}`);
  }

  // 12–14: method.
  lines.push("");
  lines.push("## Method");
  recipe.method.forEach((step, i) => lines.push(`${i + 1}. ${step}`));

  // 15–17: optional notes.
  if (recipe.notes?.length) {
    lines.push("");
    lines.push("## Notes");
    for (const note of recipe.notes) lines.push(`- ${note}`);
  }

  // 18–21: rule, tag line, blank, footer.
  lines.push("");
  lines.push("---");
  lines.push(recipe.tags.join(TAG_SEPARATOR));
  lines.push("");
  lines.push(FOOTER);

  // Files end with "mise.app\n", not "mise.app\n\n".
  return lines.join("\n") + "\n";
}
