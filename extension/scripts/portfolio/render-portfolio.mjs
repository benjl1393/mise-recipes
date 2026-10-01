/**
 * Render every Mise image on the portfolio from committed sources: the real
 * renderer and action rows, the generated popup.css, the specimen's 03A
 * fixture, the 2026-04-23 warm snapshot, and pipeline.html.
 *
 *   npm run render:portfolio -- --out <portfolio>/public/images/independent/mise
 *
 * Serves its own pages, so it needs no dist/ and no separate server:
 *   /popup/popup.css  → extension/src/popup/popup.css (the generated stylesheet)
 *   /fonts/*          → type-specimens/fonts/*  (popup.css loads ../fonts/…)
 *   /snapshots/*      → type-specimens/snapshots/*  (and /snapshots/fonts/* → the same fonts)
 *   /pipeline.html    → this folder
 *   /page/<name>      → generated below
 */
import * as esbuild from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const ext = resolve(here, "../..");
const repo = resolve(ext, "..");
const at = process.argv.indexOf("--out");
if (at < 0) throw new Error("usage: render:portfolio -- --out <dir>");
const out = resolve(process.argv[at + 1]);
await mkdir(out, { recursive: true });

// ── the real modules, bundled in memory (nothing on disk to go stale) ─────
const bundled = await esbuild.build({
  stdin: {
    contents: `
      export { ACTIONS, FIRED_ACTIONS, SUCCESS_ACTIONS, errorActions, errorFallbacks } from "./popup/actions";
      export { renderCard, renderFired, renderStamp, renderError } from "./popup/render";
      export { classify } from "./popup/errors";
      export * from "./embed/fixture";
    `,
    resolveDir: join(ext, "src"),
    loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
  define: { __MISE_DEV_KEY__: '""' },
});
const m = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const fm = m.fixtureFrontmatter(m.FIRST_TICKET, new Date("2026-04-24T18:03:00"));
const card = m.renderCard(m.FIXTURE_RECIPE, fm);
const overloaded = m.classify(Object.assign(new Error("Overloaded"), { status: 529 }));

// renderError stamps the ticket with `new Date()`, so an unpinned render differs on
// every run and reads today's date beside cards from 2026-04-24. Pin the clock for
// that one call; the rest of the card is the renderer's own output.
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) { args.length ? super(...args) : super("2026-04-24T18:03:00"); }
};
const errorCard = m.renderError(overloaded, { url: m.FIXTURE_SOURCE, fallbacks: m.errorFallbacks(true) });
globalThis.Date = RealDate;

const win = (id, body, actions, cls = "") =>
  `<div class="win" id="${id}"><main class="popup${cls}">${body}</main><div class="popup-actions">${actions}</div></div>`;
const W = {
  filled: win("filled", card, m.SUCCESS_ACTIONS),
  fired: win("fired", card + m.renderFired("2026-04-24-gochujang-glazed-pork-belly.md"), m.FIRED_ACTIONS, " fired"),
  offmenu: win("offmenu", m.renderStamp("offmenu", "Nothing to cook here.", "Mise found no recipe on this page. Try a recipe blog, a Reel, or a video."), m.ACTIONS.extract),
  error: win("error", errorCard, m.errorActions(true)),
};

const page = (inner, extra = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/popup/popup.css"><style>
  /* popup.css styles html and body as the 400px window; undo that for the stage. */
  html, body { width: auto; max-height: none; display: block; margin: 0; background: #fff; }
  .win { width: 400px; height: 600px; display: flex; flex-direction: column; overflow: hidden; }
  .win .popup { flex: 1 1 auto; min-height: 0; border: 0; box-shadow: none; }
  /* macOS overlay scrollbars are invisible at rest; headless draws classic ones. */
  .win .popup::-webkit-scrollbar { display: none; }
  .stage { position: relative; overflow: hidden; background: var(--bg-page); }
  .stage .win { position: absolute; }
  ${extra}
</style></head><body>${inner}</body></html>`;

const PAGES = {
  stills: page(`<div style="display:flex;gap:40px;padding:40px;align-items:flex-start">${W.filled}${W.fired}</div>`),
  // Cover, 16:10: the three ways a card ends up, centred on the window surround.
  cover: page(`<div class="stage" id="cover" style="width:1360px;height:850px">${W.filled}${W.fired}${W.offmenu}</div>`,
    `#cover .win { top: 125px } #cover .win:nth-child(1) { left: 40px } #cover .win:nth-child(2) { left: 480px } #cover .win:nth-child(3) { left: 920px }`),
  // The stamp ladder: grey nothing, black saved, red broken.
  ladder: page(`<div class="stage" id="ladder" style="width:1360px;height:680px">${W.offmenu}${W.fired}${W.error}</div>`,
    `#ladder .win { top: 40px } #ladder .win:nth-child(1) { left: 40px } #ladder .win:nth-child(2) { left: 480px } #ladder .win:nth-child(3) { left: 920px }`),
  // "Now" side of the before pair: the card alone, cropped like the snapshot.
  now: page(`<div style="padding:40px"><main class="popup" id="now" style="width:400px;border:0;box-shadow:none">${card}</main></div>`),
};

// ── a tiny static server ───────────────────────────────────────────────────
const TYPES = { ".css": "text/css", ".html": "text/html", ".woff2": "font/woff2", ".otf": "font/otf", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x").pathname;
  try {
    let body, file;
    if (url.startsWith("/page/")) body = PAGES[url.slice(6)];
    else if (url === "/popup/popup.css") file = join(ext, "src/popup/popup.css");
    else if (url.startsWith("/fonts/")) file = join(repo, "type-specimens/fonts", url.slice(7));
    // The snapshot's @font-face says ./fonts/…, which from /snapshots/ is a folder that
    // does not exist (the fonts live one level up). Serve them rather than edit a frozen file.
    else if (url.startsWith("/snapshots/fonts/")) file = join(repo, "type-specimens/fonts", url.slice(17));
    else if (url.startsWith("/snapshots/")) file = join(repo, "type-specimens/snapshots", url.slice(11));
    else if (url === "/pipeline.html") file = join(here, "pipeline.html");
    if (file) body = await readFile(file);
    if (body === undefined) throw new Error("404");
    res.writeHead(200, { "content-type": TYPES[extname(file ?? "page.html")] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// ── capture ────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
// `crop` caps the element at the 600px window height, so the two halves of the
// before pair are the same crop. Done in CSS rather than with screenshot clip
// coordinates, which go wrong when the element sits below the fold. It also pins
// the element to the origin: the snapshot's card lands at y=468.42, and an element
// screenshot rounds a fractional box outward, so it came out 1202px tall, not 1200.
async function shoot(path, selector, file, crop = false) {
  const p = await ctx.newPage();
  await p.goto(base + path);
  if (crop) await p.addStyleTag({ content: `${selector} { max-height: 600px !important; overflow: hidden !important; position: fixed !important; top: 0 !important; left: 0 !important; margin: 0 !important; }` });
  await p.evaluate(() => document.fonts.ready);
  const bad = await p.evaluate(() => [...document.fonts].filter((f) => f.status === "error").map((f) => f.family));
  if (bad.length) throw new Error(`${path}: font failed: ${bad.join(", ")}`);
  await p.locator(selector).first().screenshot({ path: join(out, file) });
  await p.close();
  console.log(`  ${file}`);
}
await shoot("/page/stills", "#filled", "card-filled.png");
await shoot("/page/stills", "#fired", "card-fired.png");
await shoot("/page/cover", "#cover", "cover.png");
await shoot("/page/ladder", "#ladder", "ladder.png");
await shoot("/page/now", "#now", "before-now.png", true);
await shoot("/snapshots/2026-04-23-v2-warm-palette-final.html", ".popup-frame .popup", "before-warm.png", true);
await shoot("/pipeline.html", "#pipeline", "pipeline.png");
await browser.close();
server.close();
console.log(`portfolio images → ${out}`);
