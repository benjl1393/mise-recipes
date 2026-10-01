/**
 * Build the portfolio embed: the real popup driven by a fixture, as a static
 * folder another site can serve. Generated, never hand-edited — re-run this.
 *
 *   npm run build:embed                                   # → extension/.embed
 *   npm run build:embed -- --out ../portfolio/.../public/embeds/mise
 *
 * Never reads api_key.txt, and defines the dev-key constant as empty: this
 * folder is published on a public website.
 */
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = (...parts) => resolve(here, "..", ...parts);

const at = process.argv.indexOf("--out");
const out = at > -1 ? resolve(process.argv[at + 1]) : from(".embed");
// The folder is deleted before writing, so only ever delete an embed folder.
if (!["mise", ".embed"].includes(basename(out))) {
  throw new Error(`refusing --out ${out}: the last segment must be "mise" or ".embed"`);
}

// Same faces build.mjs ships.
const FONTS = ["DepartureMono-Regular.woff2", "CommitMono-400-Regular.otf", "CommitMono-400-Italic.otf", "DepartureMono-LICENSE.txt", "CommitMono-LICENSE.txt"];

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/popup`, { recursive: true });
await mkdir(`${out}/fonts`, { recursive: true });
// popup.css loads ../fonts/… — the popup/ + fonts/ layout keeps that path true.
await cp(from("src/popup/popup.css"), `${out}/popup/popup.css`);
for (const font of FONTS) await cp(from("../type-specimens/fonts", font), `${out}/fonts/${font}`);
await cp(from("src/embed/index.html"), `${out}/index.html`);

await esbuild.build({
  entryPoints: [from("src/embed/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: `${out}/embed.js`,
  minify: true,
  define: { __MISE_DEV_KEY__: '""' },
  logLevel: "warning",
});

const git = (...args) => execFileSync("git", args, { cwd: from(".."), encoding: "utf8" }).trim();
// --untracked-files=no: untracked files are not build inputs, and the checkout carries untracked files that are not ours.
const dirty = git("status", "--porcelain", "--untracked-files=no").length > 0;
await writeFile(
  `${out}/provenance.json`,
  JSON.stringify(
    { source: "recipe-archiver", commit: git("rev-parse", "HEAD"), dirty, builtAt: new Date().toISOString() },
    null,
    2,
  ) + "\n",
);
console.log(`embed → ${out}`);
