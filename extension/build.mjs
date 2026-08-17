import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

// Static assets: manifest, HTML/CSS, fonts, icons.
await cp("manifest.json", `${outdir}/manifest.json`);
for (const dir of ["popup", "pass", "prep"]) {
  await cp(`src/${dir}`, `${outdir}/${dir}`, {
    recursive: true,
    filter: (src) => !src.endsWith(".ts"),
  });
}
await cp("../type-specimens/fonts", `${outdir}/fonts`, { recursive: true });
await cp("../type-specimens/mark/png", `${outdir}/icons`, { recursive: true });

const ctx = await esbuild.context({
  entryPoints: {
    "popup/popup": "src/popup/popup.ts",
    "pass/pass": "src/pass/pass.ts",
    "prep/prep": "src/prep/prep.ts",
    "background/service-worker": "src/background/service-worker.ts",
    "content/extract": "src/content/extract.ts",
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
