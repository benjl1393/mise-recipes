/**
 * Audit the popup's markup/CSS contract.
 *
 * The design system is ported from type-specimens/, so popup.css is the
 * authority on what classes exist. The renderer has to emit exactly those
 * class names or styling silently no-ops — a failure mode unit tests cannot
 * see, because the DOM is still "correct", just unstyled.
 *
 * Reports two asymmetries:
 *   MISSING  — styled in CSS, never emitted by the renderer. Either a state
 *              that was designed and not built, or a name that drifted.
 *   UNSTYLED — emitted by the renderer with no rule in CSS. Usually a typo.
 *
 * Not every MISSING entry is a bug: some classes are toggled by the
 * controller (popup.ts) or belong to specimen-only scaffolding, so the
 * scan covers popup.ts and popup.html too.
 *
 *   node scripts/audit-port.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const at = (...p) => resolve(here, "..", ...p);

const css = readFileSync(at("src/popup/popup.css"), "utf8");
const sources = [
  "src/popup/render.ts",
  "src/popup/popup.ts",
  // The action rows moved out of popup.ts on 2026-08-30. Without this the
  // audit reported every button class as styled-but-never-emitted.
  "src/popup/actions.ts",
  // Carries the Tabler icon markup, and so the only source of .btn-icon.
  "src/popup/glyphs.ts",
  "src/popup/popup.html",
]
  .map((f) => readFileSync(at(f), "utf8"))
  .join("\n");

// Class selectors in CSS. Comments and quoted strings are stripped first,
// or url("../fonts/CommitMono.otf") reads as a class called `otf`. A
// lookbehind cannot do this job — it would also reject the compound
// selectors the design system relies on (h2.title, .badge.pending).
const selectors = css.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(["'])(?:\\.|(?!\1).)*\1/g, " ");
const styled = new Set();
for (const m of selectors.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) styled.add(m[1]);

// Classes the renderer can emit. The capture deliberately stops at `$`:
// nested template interpolations cannot be blanked reliably, so an
// interpolated modifier is handled via IGNORE plus a render test instead.
const emitted = new Set();
for (const m of sources.matchAll(/class=["'`]([^"'`$]*)/g)) {
  for (const c of m[1].split(/\s+/)) if (c) emitted.add(c);
}
for (const m of sources.matchAll(/classList\.(?:add|remove|toggle)\(\s*["']([\w-]+)/g)) {
  emitted.add(m[1]);
}
// modifier: " err" style fragments, and bare quoted words used as classes
for (const m of sources.matchAll(/modifier:\s*["']\s*([\w-]+)/g)) emitted.add(m[1]);

const IGNORE = new Set([
  // CSS-only concerns that never appear as authored class attributes.
  "popup",
  "skel",
  // Spliced in as interpolated bar-size modifiers; covered by the
  // "uses the specimen's bar size modifiers" case in tests/render.test.ts.
  "thin",
  "tall",
  "tallx",
]);

const missing = [...styled].filter((c) => !emitted.has(c) && !IGNORE.has(c)).sort();
const unstyled = [...emitted].filter((c) => !styled.has(c)).sort();

console.log(`styled in CSS: ${styled.size}   emitted by renderer: ${emitted.size}\n`);
console.log(`MISSING — styled but never emitted (${missing.length}):`);
for (const c of missing) console.log(`  .${c}`);
console.log(`\nUNSTYLED — emitted but no CSS rule (${unstyled.length}):`);
for (const c of unstyled) console.log(`  .${c}`);
