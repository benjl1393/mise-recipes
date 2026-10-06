import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// npm runs this from the repo root, so anchor every path to the script itself.
const here = dirname(fileURLToPath(import.meta.url));
const from = (...parts) => resolve(here, ...parts);

const watch = process.argv.includes("--watch");
const outdir = from("dist");

/**
 * Dev-only convenience: seed the API key so reinstalling the unpacked extension
 * doesn't mean retyping it. Removing an extension clears its storage, so every
 * test build otherwise starts with an empty Prep.
 *
 * The key is read at BUILD time from api_key.txt, which is gitignored, and is
 * never written into source. It is also opt-in — without --dev the constant is
 * an empty string, so a release build cannot carry it even by accident.
 *
 * It does land in dist/popup/popup.js, which is why dist/ is gitignored too.
 * Do not hand a --dev build to anyone else.
 */
const dev = process.argv.includes("--dev");
let devKey = "";
if (dev) {
  try {
    devKey = readFileSync(from("../api_key.txt"), "utf8").trim();
    console.log(`[mise] dev build — seeding API key from api_key.txt (${devKey.length} chars)`);
  } catch {
    console.log("[mise] dev build — no api_key.txt found, Prep will start empty");
  }
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

// Static assets: manifest, HTML/CSS, fonts, icons.
await cp(from("manifest.json"), `${outdir}/manifest.json`);
for (const dir of ["popup"]) {
  await cp(from("src", dir), `${outdir}/${dir}`, {
    recursive: true,
    filter: (src) => !src.endsWith(".ts"),
  });
}
// Only the locked v2.1 faces ship, each with its MIT licence beside it.
// type-specimens/fonts/ also holds Redaction, rejected during the type crit —
// copying the whole directory would put dead weight in the bundle. (Basier
// Square Mono was rejected too, and removed: its licence forbids
// redistribution, and this repository is public.)
const FONTS = [
  "DepartureMono-Regular.woff2",
  "CommitMono-400-Regular.otf",
  "CommitMono-400-Italic.otf",
  "DepartureMono-LICENSE.txt",
  "CommitMono-LICENSE.txt",
];
await mkdir(`${outdir}/fonts`, { recursive: true });
for (const font of FONTS) {
  await cp(from("../type-specimens/fonts", font), `${outdir}/fonts/${font}`);
}
await cp(from("../type-specimens/mark/png"), `${outdir}/icons`, { recursive: true });

const ctx = await esbuild.context({
  entryPoints: {
    "popup/popup": from("src/popup/popup.ts"),
    "background/service-worker": from("src/background/service-worker.ts"),
    "content/extract": from("src/content/extract.ts"),
    "content/detect": from("src/content/detect.ts"),
  },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir,
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  define: { __MISE_DEV_KEY__: JSON.stringify(devKey) },
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("[mise] watching…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
