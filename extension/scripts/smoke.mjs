/**
 * Load the built extension in a real Chromium and drive all three surfaces.
 * Verifies the MV3 manifest is accepted, the service worker registers, and
 * each page boots without console errors — none of which unit tests can see.
 *
 * Playwright is deliberately NOT a dependency (it pulls a ~95MB browser).
 * Install it on demand:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run build:ext && npm run smoke:ext
 */
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, "../dist");
const SHOTS = resolve(here, "../../.scratch");

const userDataDir = mkdtempSync(join(tmpdir(), "mise-smoke-"));
const errors = [];
const note = (where, msg) => errors.push(`${where}: ${msg}`);

const ctx = await chromium.launchPersistentContext(userDataDir, {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

// The service worker registering is the proof MV3 accepted the manifest.
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => null);
if (!sw) {
  note("manifest", "service worker never registered — MV3 load failed");
} else {
  console.log(`✓ service worker: ${sw.url()}`);
}

const extId = sw ? new URL(sw.url()).host : null;

async function visit(name, path, prep) {
  if (!extId) return;
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") note(name, m.text());
  });
  page.on("pageerror", (e) => note(name, `uncaught: ${e.message}`));
  if (prep) await page.addInitScript(prep);
  await page.goto(`chrome-extension://${extId}/${path}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/smoke-${name}.png`, fullPage: true });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  console.log(`✓ ${name}: ${text.slice(0, 110)}`);
  await page.close();
}

// Popup with no key configured — should land on the Kitchen Error stamp.
await visit("popup-nokey", "popup/popup.html");

// Prep, pre-seeded so the form has something to load.
await visit("prep", "prep/prep.html", () => {
  // eslint-disable-next-line no-undef
  chrome.storage.local.set({
    "mise:settings": {
      apiKey: "sk-ant-fake",
      units: "imperial",
      model: "claude-opus-5",
      captureFrames: false,
    },
  });
});

// The Pass, pre-seeded with two tickets.
await visit("pass", "pass/pass.html", () => {
  const t = (n, title) => ({
    frontmatter: {
      ticket: n,
      captured: "2026-04-22T16:28",
      source: `https://example.com/${n}`,
      via: "article text",
    },
    recipe: {
      title,
      serves: "4",
      hands_on: "25m",
      ingredients: [{ qty: "800 g", item: "pork belly, skin-on" }],
      method: ["Score the skin.", "Roast."],
      tags: ["#pork", "#braise"],
    },
  });
  // eslint-disable-next-line no-undef
  chrome.storage.local.set({
    "mise:pass": [t(2, "Cacio e Pepe"), t(1, "Gochujang-Glazed Pork Belly")],
  });
});

await ctx.close();

if (errors.length) {
  console.log(`\n✗ ${errors.length} console/page error(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\n✓ all surfaces booted clean");
