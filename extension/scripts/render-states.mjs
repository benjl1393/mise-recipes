/**
 * Renders every popup state to a static HTML page so it can be screenshotted
 * and *looked at*.
 *
 * This exists because `popup.ts` resolves its DOM handles at module scope, so
 * importing it outside a browser throws — the action rows could not be
 * rendered on their own to be reviewed. `actions.ts` was split out for exactly
 * this, and the rows have been wrong in ways only looking could catch: the
 * success row was overflowing the 400px window by 15.8px for a day, and no
 * unit test, audit or type-check could see it.
 *
 * It renders the REAL renderer and the REAL action rows against the REAL
 * generated stylesheet. The only thing authored here is the window frame,
 * which mirrors popup.html.
 *
 * ── Why this bundles itself on every run ────────────────────────────────
 * The earlier version of this tool lived in .scratch/ as a TypeScript entry
 * that had to be esbuild-bundled by hand before running. Re-running the stale
 * bundle renders FRESH CSS with OLD markup — a page that looks entirely
 * coherent and is wrong only in the half you just changed. That produced one
 * confidently wrong measurement before it was caught.
 *
 * So nothing is ever written to disk to go stale: esbuild bundles in memory
 * (`write: false`) and the result is imported straight from a data: URL. There
 * is no build step to forget.
 *
 *   npm run render:states
 *   npx serve extension/.render   (or any static server — see below)
 *
 * Serve it over HTTP rather than opening the file directly: `file://` blocks
 * the web fonts, so Departure and Commit Mono silently fall back to system
 * mono and misrepresent the typography.
 *
 * ── Checking that a row fits ────────────────────────────────────────────
 * Do NOT trust `scrollWidth`. `.popup-actions` is `overflow: visible`, so it
 * reads equal to `clientWidth` even while buttons spill off the edge. Measure
 * the last button's right edge against the row's content box, in a real
 * browser:
 *
 *   const cs = getComputedStyle(row);
 *   const last = [...row.querySelectorAll('button')].pop().getBoundingClientRect();
 *   last.right - (row.getBoundingClientRect().right - parseFloat(cs.paddingRight));
 *   // > 0 means the row overflows
 */
import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// npm runs this from the repo root, so anchor every path to the script itself.
const here = dirname(fileURLToPath(import.meta.url));
const from = (...parts) => resolve(here, ...parts);

const outDir = from("..", ".render");
const outFile = resolve(outDir, "states.html");

// ── 1. Bundle the real modules in memory ─────────────────────────────────
// stdin rather than a checked-in .ts entry: one file to maintain, and nothing
// on disk that a later run could pick up stale.
const bundled = await esbuild.build({
  stdin: {
    contents: `
      export { ACTIONS, errorActions, FIRED_ACTIONS, SUCCESS_ACTIONS } from "../src/popup/actions";
      export { renderCard, renderFired, renderStamp } from "../src/popup/render";
    `,
    resolveDir: here,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});

const code = bundled.outputFiles[0].text;
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const { ACTIONS, errorActions, FIRED_ACTIONS, SUCCESS_ACTIONS } = mod;
const { renderCard, renderFired, renderStamp } = mod;

// ── 2. Fixtures ──────────────────────────────────────────────────────────
/** A real card, so the FIRED overlay sits on what it actually dims. */
const recipe = {
  title: "Gochujang-Glazed Pork Belly",
  subtitle: "slow-rendered, sharply-sauced.",
  serves: "4",
  hands_on: "25m",
  total: "2h 10m",
  ingredients: [
    { qty: "800 g", item: "pork belly, skin-on" },
    { qty: "2 tbsp", item: "gochujang" },
    { qty: "—", item: "spring onion to finish" },
  ],
  method: ["Score the skin.", "Roast at 160 °C for two hours.", "Glaze and blast at 220 °C."],
  tags: ["#cuisine/korean", "#pork"],
};

const fm = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://instagram.com/p/C9xK2",
  via: "8 video frames",
};

const offMenu = renderStamp(
  "offmenu",
  "Nothing to cook here.",
  "Mise found no recipe on this page. Try a recipe blog, a Reel, or a video.",
);
const errStamp = renderStamp("error", "Something broke mid-service.");
const firedCard = renderCard(recipe, fm) + renderFired("2026-04-24-gochujang-pork-belly.md");

// ── 3. The window frame — mirrors popup.html ─────────────────────────────
const win = (caption, card, actions, cls = "") =>
  `<div class="col"><p class="cap">${caption}</p><div class="win">` +
  `<main class="popup${cls}">${card}</main>` +
  `<div class="popup-actions">${actions}</div></div></div>`;

const body = [
  win("FIRED — inverted stamp, pixel flame", firedCard, FIRED_ACTIONS, " fired"),
  win("OFF MENU", offMenu, ACTIONS.extract),
  win("KITCHEN ERROR — red fill, retryable", errStamp, errorActions(true)),
  win("KITCHEN ERROR — terminal, no RETRY", errStamp, errorActions(false)),
  win("SUCCESS — four buttons, the tight row", offMenu, SUCCESS_ACTIONS),
  win("ARCHIVE pane", offMenu, ACTIONS.archive),
  win("PREP pane", offMenu, ACTIONS.prep),
].join("\n");

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Mise — popup states</title>
<link rel="stylesheet" href="../dist/popup/popup.css">
<style>
  /* No font-family here: the popup's own body rule sets Commit Mono, and text
     with no rule of its own (ol.method li) inherits it. A system-ui override
     here once set the method steps in a sans the product never shows. */
  body { margin: 0; background: #6e6e6e; padding: 28px; display: flex; gap: 28px;
         align-items: flex-start; flex-wrap: wrap; }
  .win { width: 400px; display: flex; flex-direction: column;
         box-shadow: 0 18px 50px -18px rgba(0,0,0,.6); }
  .win .popup { width: 100%; border: 0; box-shadow: none; }
  .cap { color: #fff; font: 11px ui-monospace, monospace; margin: 0 0 7px; opacity: .85; }
  .col { display: flex; flex-direction: column; }
</style></head><body>
${body}
</body></html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(outFile, page);

console.log(`wrote ${outFile}`);
console.log("  stylesheet: extension/dist/popup/popup.css — run build:ext first if it is stale");
console.log("  serve over HTTP, not file:// — file:// blocks the web fonts");
