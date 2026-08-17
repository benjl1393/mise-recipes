import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// npm runs this from the repo root, so anchor every path to the script itself.
const here = dirname(fileURLToPath(import.meta.url));
const from = (...parts) => resolve(here, ...parts);

const watch = process.argv.includes("--watch");
const outdir = from("dist");

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
// Only the locked v2.1 faces ship. type-specimens/fonts/ also holds Redaction
// and Basier Square Mono, both rejected during the type crit — copying the
// whole directory would put ~140KB of dead weight in the store bundle.
const FONTS = [
  "DepartureMono-Regular.woff2",
  "CommitMono-400-Regular.otf",
  "CommitMono-400-Italic.otf",
  "OFL.txt",
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
  },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir,
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("[mise] watching…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
