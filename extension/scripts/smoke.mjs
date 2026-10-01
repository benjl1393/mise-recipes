/**
 * Load the built extension in a real Chromium and drive all three surfaces.
 * Verifies the MV3 manifest is accepted, the service worker registers, and
 * each page boots without console errors — none of which unit tests can see.
 *
 * Playwright is a devDependency (2026-10-01). It used to be left out because
 * it pulled a ~95MB browser, but the package has no install script any more:
 * `npm i` adds ~18MB of JS and no browser. The browser is a separate,
 * one-off step per machine:
 *
 *   npx playwright install chromium
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

async function visit(name, path, prep, clickSelector) {
  if (!extId) return;
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") note(name, m.text());
  });
  page.on("pageerror", (e) => note(name, `uncaught: ${e.message}`));
  if (prep) await page.addInitScript(prep);
  await page.goto(`chrome-extension://${extId}/${path}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  if (clickSelector) {
    const button = page.locator(clickSelector);
    if ((await button.count()) === 0) {
      note(name, `no route to this view: ${clickSelector} is not in the action row`);
      await page.close();
      return;
    }
    await button.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${SHOTS}/smoke-${name}.png`, fullPage: true });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  console.log(`✓ ${name}: ${text.slice(0, 110)}`);
  await page.close();
}

// Prep and Archive are panes in the popup now, not pages — there is one
// document to load and the views are reached by clicking the action row.
const seed = () => {
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
    "mise:settings": {
      apiKey: "",
      units: "imperial",
      model: "claude-opus-5",
      captureFrames: false,
    },
    "mise:archive": [t(2, "Cacio e Pepe"), t(1, "Gochujang-Glazed Pork Belly")],
  });
};

// No key configured — should land on the Kitchen Error card.
await visit("popup-nokey", "popup/popup.html", seed);

// Then the two panes, reached the way a user reaches them.
await visit("prep", "popup/popup.html", seed, "#prep");
await visit("archive", "popup/popup.html", seed, "#archive");

await ctx.close();

if (errors.length) {
  console.log(`\n✗ ${errors.length} console/page error(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\n✓ all surfaces booted clean");
