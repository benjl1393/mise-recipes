# Mise Chrome MV3 Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Mise Chrome MV3 extension — click the toolbar icon on a recipe page, Reel, TikTok, or YouTube video; a ticket card fills in as Claude extracts the recipe; press Enter to Fire a `.md` file to disk.

**Architecture:** Zero-backend, BYOK. A content script scrapes the page (JSON-LD → Readability → captions) and hands a payload to the popup. The popup calls the Anthropic API directly with the user's key from `chrome.storage.local`, using structured outputs to guarantee a parseable `Recipe` object. A pure serializer turns `Recipe` into the `.md` artifact; `chrome.downloads` writes it. History lives in `chrome.storage.local` and renders in a full-tab view (The Pass). The popup's visual layer is ported wholesale from the existing design specimen — no new design work.

**Tech Stack:** TypeScript, esbuild (single build step, no framework), `@anthropic-ai/sdk`, `@mozilla/readability`, vitest. Chrome MV3.

**Spec:** `docs/mise-md-format.md` (the `.md` output contract — the artifact is the product), `CLAUDE.md` (brand, aesthetic direction, internal kitchen language, locked type/color/icon systems), `docs/mise-color-system.md`.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **The `.md` is the source of truth.** "Nothing may appear in a rendered surface without a corresponding `.md` field." Popup, PDF, and The Pass are typographic renderings of the format in `docs/mise-md-format.md`.
- **Mandatory element ordering** in every `.md` file — the 21-step list in `docs/mise-md-format.md` § Mandatory Ordering. "No trailing newline after the footer (files end with `mise.app\n`, not `mise.app\n\n`)."
- **Ingredient separator** is exactly `  ·  ` — two spaces, middle-dot (`U+00B7`), two spaces. Five characters.
- **Footer** is exactly one line: glyph `✶` (`U+2736`), one space, `mise.app`. No link markup.
- **Frontmatter keys** are `ticket`, `captured`, `source`, `via`, `serves`, `hands_on`, `total`, `units`, `scaled` — in that order. `hands_on` uses an underscore; the popup displays it as `HANDS-ON`.
- **Display-vs-YAML divergence** is allowed only where documented: YAML `ticket:` renders as `NO.` in the popup. Everything else matches.
- **Internal kitchen language is load-bearing** — use in code, UI, docs, and commit messages: **Mise** (product), **Fire** (primary save action), **The Pass** (full-tab history), **Prep** (options page), **Off Menu** (empty state), **Kitchen Error** (error stamp).
- **Type roles:** Departure Mono = chrome (ticket-top, footer, title, section headings, stamps). Commit Mono = content (source URL, badge, subtitle, facts row, ingredients, method, notes, tag line).
- **No new design decisions.** Type, color, icons are locked at v2.2. Port the CSS from `type-specimens/popup-states.html`; do not restyle. Anti-AI guardrails in `CLAUDE.md` apply to anything not covered by the port.
- **Popup is 400px wide, variable height.** MV3 caps popup height at 600px — the card scrolls internally, the action row is pinned.
- **Accessibility:** WCAG AA contrast on all text. `Enter` = Fire, `Esc` = close, `Tab` cycles logical order. Semantic recipe markup (headings, `<ul>` ingredients, `<ol>` method). `prefers-reduced-motion` respected on the skeleton→filled transition.
- **BYOK:** the user's Anthropic key lives in `chrome.storage.local` and is never transmitted anywhere except `api.anthropic.com`. Zero backend for AI.
- **Model:** `claude-haiku-4-5` by default (per the 2026-04-19/20 scope decision that BYOK cost per extraction is a product constraint), user-overridable in Prep to `claude-opus-5`. Haiku 4.5 does **not** support `output_config.effort` or adaptive thinking — do not send either. It **does** support structured outputs and vision.
- **Vision resolution:** Haiku 4.5 caps at 1568px on the long edge. Downsample captured frames to fit before encoding.
- **Browser API access:** direct calls to `api.anthropic.com` from an extension require the `anthropic-dangerous-direct-browser-access: true` header and `dangerouslyAllowBrowser: true` on the SDK client.
- **Permissions at install:** `activeTab`, `contextMenus`, `storage`, `scripting`, `downloads`. `<all_urls>` lives in `optional_host_permissions` and is requested only when the user enables video frame capture on a new domain.

---

### Task 1: Extension scaffold, manifest, and build pipeline

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/build.mjs`
- Create: `extension/tsconfig.json`
- Create: `extension/src/lib/types.ts`
- Create: `extension/vitest.config.ts`
- Create: `extension/tests/manifest.test.ts`
- Modify: `package.json` (add `build:ext`, `test:ext` scripts and `esbuild` devDependency)
- Modify: `.gitignore` (add `extension/dist/`)

**Interfaces:**
- Consumes: nothing.
- Produces: `extension/dist/` build output; the `Recipe`, `RecipeIngredient`, `Frontmatter`, and `ViaMethod` types in `extension/src/lib/types.ts` that every later task imports.

- [ ] **Step 1: Write the failing test**

Create `extension/tests/manifest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import manifest from "../manifest.json";

describe("manifest", () => {
  it("is MV3 and named Mise", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("Mise");
  });

  it("requests only the install-time permissions the spec allows", () => {
    expect(manifest.permissions.sort()).toEqual(
      ["activeTab", "contextMenus", "downloads", "scripting", "storage"].sort(),
    );
    expect(manifest.optional_host_permissions).toEqual(["<all_urls>"]);
    expect(manifest.host_permissions).toEqual(["https://api.anthropic.com/*"]);
  });

  it("ships the full icon ladder", () => {
    expect(Object.keys(manifest.icons).sort()).toEqual(["128", "16", "32", "48"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/manifest.test.ts`
Expected: FAIL — `Cannot find module '../manifest.json'`.

- [ ] **Step 3: Create the manifest**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Mise",
  "version": "0.1.0",
  "description": "Fire recipes from anywhere to portable .md files you own.",
  "icons": {
    "16": "icons/mise-icon-16.png",
    "32": "icons/mise-icon-32.png",
    "48": "icons/mise-icon-48.png",
    "128": "icons/mise-icon-128.png"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Fire this recipe to Mise",
    "default_icon": {
      "16": "icons/mise-icon-16.png",
      "32": "icons/mise-icon-32.png"
    }
  },
  "background": { "service_worker": "background/service-worker.js", "type": "module" },
  "options_page": "prep/prep.html",
  "permissions": ["activeTab", "contextMenus", "downloads", "scripting", "storage"],
  "host_permissions": ["https://api.anthropic.com/*"],
  "optional_host_permissions": ["<all_urls>"],
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Ctrl+Shift+M", "mac": "Command+Shift+M" },
      "description": "Fire the current page to Mise"
    }
  },
  "web_accessible_resources": [
    { "resources": ["fonts/*"], "matches": ["<all_urls>"] }
  ]
}
```

- [ ] **Step 4: Create the shared types**

Create `extension/src/lib/types.ts`:

```ts
/** Controlled extraction-method vocabulary — docs/mise-md-format.md § `via`. */
export type ViaMethod =
  | `${number} video frames`
  | "caption only"
  | "schema data"
  | "article text"
  | "manual paste"
  | "image upload";

export type Units = "metric" | "imperial";

export interface RecipeIngredient {
  /** Quantity with a space between number and unit ("800 g"). Em-dash "—" when unmeasured. */
  qty: string;
  /** Lowercase prose, brief modifiers allowed ("pork belly, skin-on"). */
  item: string;
}

/** The model's extraction output. Maps 1:1 onto the .md body. */
export interface Recipe {
  title: string;
  subtitle?: string;
  serves: string;
  hands_on?: string;
  total?: string;
  ingredients: RecipeIngredient[];
  method: string[];
  notes?: string[];
  tags: string[];
}

/** Capture metadata the extension generates — never the model. */
export interface Frontmatter {
  ticket: number;
  captured: Date;
  source: string;
  via: ViaMethod;
  units?: Units;
  scaled?: number;
}

/** One fired ticket, as stored in The Pass. */
export interface Ticket {
  frontmatter: Omit<Frontmatter, "captured"> & { captured: string };
  recipe: Recipe;
}
```

- [ ] **Step 5: Create tsconfig and vitest config**

Create `extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["chrome", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `extension/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", globals: true, include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 6: Create the build script**

Create `extension/build.mjs`:

```js
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
```

- [ ] **Step 7: Add scripts and dependencies**

Run:

```bash
cd /Users/benjaminli/Code/recipe-archiver
npm install --save-dev esbuild @types/chrome
npm pkg set scripts.build:ext="node extension/build.mjs"
npm pkg set scripts.watch:ext="node extension/build.mjs --watch"
npm pkg set scripts.test:ext="vitest run --root extension"
```

Append `extension/dist/` to `.gitignore`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/manifest.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 9: Commit**

```bash
git add extension .gitignore package.json package-lock.json
git commit -m "feat(mise): scaffold MV3 extension, manifest, and esbuild pipeline"
```

---

### Task 2: The `.md` serializer

The artifact is the product. This task is the contract every other surface renders; build it first and test it hardest.

**Files:**
- Create: `extension/src/lib/markdown.ts`
- Create: `extension/tests/markdown.test.ts`

**Interfaces:**
- Consumes: `Recipe`, `Frontmatter` from `src/lib/types.ts` (Task 1).
- Produces: `serializeRecipe(recipe: Recipe, fm: Frontmatter): string` and `formatTicket(n: number): string` (5-digit zero-padded), `formatCaptured(d: Date): string` (ISO 8601 to the minute, e.g. `2026-04-22T16:28`).

- [ ] **Step 1: Write the failing test**

Create `extension/tests/markdown.test.ts`. The expected output is the Full Example from `docs/mise-md-format.md` verbatim:

```ts
import { describe, it, expect } from "vitest";
import { serializeRecipe, formatTicket, formatCaptured } from "../src/lib/markdown";
import type { Recipe, Frontmatter } from "../src/lib/types";

const SEP = "  ·  ";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  subtitle: "slow-rendered, sharply-sauced, served over rice with a soft egg.",
  serves: "4",
  hands_on: "25m",
  total: "2h 10m",
  ingredients: [
    { qty: "800 g", item: "pork belly, skin-on" },
    { qty: "3 tbsp", item: "gochujang paste" },
    { qty: "2 tbsp", item: "honey or maltose" },
    { qty: "1½ tbsp", item: "soy sauce (light)" },
    { qty: "4 cloves", item: "garlic, crushed" },
    { qty: "1 thumb", item: "ginger, julienned" },
    { qty: "—", item: "spring onion & sesame to finish" },
  ],
  method: [
    "Score the pork belly skin in a crosshatch, just through the fat. Salt heavily, uncovered in the fridge overnight — this is non-negotiable.",
    "Sear skin-down in a dry cast-iron until the skin blisters and shatters when tapped. Drain most of the fat.",
    "Whisk gochujang, honey, soy, garlic and ginger with 100 ml water. Pour around (not over) the pork. Cover, oven 160 °C for 90 minutes.",
    "Uncover, turn skin-up, ladle the sticky sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.",
  ],
  tags: ["#cuisine/korean", "#pork", "#braise", "#weeknight"],
};

const fm: Frontmatter = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://instagram.com/p/C9xK2",
  via: "8 video frames",
};

describe("formatTicket", () => {
  it("zero-pads to five digits", () => {
    expect(formatTicket(427)).toBe("00427");
    expect(formatTicket(1)).toBe("00001");
    expect(formatTicket(99999)).toBe("99999");
  });
});

describe("formatCaptured", () => {
  it("emits ISO 8601 to the minute, no seconds, no zone", () => {
    expect(formatCaptured(new Date("2026-04-22T16:28:31"))).toBe("2026-04-22T16:28");
  });
});

describe("serializeRecipe", () => {
  const md = serializeRecipe(recipe, fm);

  it("matches the spec's full example byte for byte", () => {
    expect(md).toBe(
      [
        "---",
        "ticket: 00427",
        "captured: 2026-04-22T16:28",
        "source: https://instagram.com/p/C9xK2",
        "via: 8 video frames",
        "serves: 4",
        "hands_on: 25m",
        "total: 2h 10m",
        "---",
        "",
        "# Gochujang-Glazed Pork Belly",
        "",
        "*slow-rendered, sharply-sauced, served over rice with a soft egg.*",
        "",
        "## Ingredients",
        `- 800 g${SEP}pork belly, skin-on`,
        `- 3 tbsp${SEP}gochujang paste`,
        `- 2 tbsp${SEP}honey or maltose`,
        `- 1½ tbsp${SEP}soy sauce (light)`,
        `- 4 cloves${SEP}garlic, crushed`,
        `- 1 thumb${SEP}ginger, julienned`,
        `- —${SEP}spring onion & sesame to finish`,
        "",
        "## Method",
        "1. Score the pork belly skin in a crosshatch, just through the fat. Salt heavily, uncovered in the fridge overnight — this is non-negotiable.",
        "2. Sear skin-down in a dry cast-iron until the skin blisters and shatters when tapped. Drain most of the fat.",
        "3. Whisk gochujang, honey, soy, garlic and ginger with 100 ml water. Pour around (not over) the pork. Cover, oven 160 °C for 90 minutes.",
        "4. Uncover, turn skin-up, ladle the sticky sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.",
        "",
        "---",
        "#cuisine/korean · #pork · #braise · #weeknight",
        "",
        "✶ mise.app",
        "",
      ].join("\n"),
    );
  });

  it("ends with exactly one trailing newline after the footer", () => {
    expect(md.endsWith("mise.app\n")).toBe(true);
    expect(md.endsWith("mise.app\n\n")).toBe(false);
  });

  it("omits optional frontmatter fields when absent", () => {
    const bare = serializeRecipe(
      { ...recipe, hands_on: undefined, total: undefined },
      fm,
    );
    expect(bare).not.toContain("hands_on:");
    expect(bare).not.toContain("total:");
    expect(bare).toContain("serves: 4");
  });

  it("emits units and scaled only when set, after the time fields", () => {
    const scaled = serializeRecipe(recipe, { ...fm, units: "imperial", scaled: 1.5 });
    const lines = scaled.split("\n");
    expect(lines.indexOf("units: imperial")).toBeGreaterThan(lines.indexOf("total: 2h 10m"));
    expect(lines[lines.indexOf("units: imperial") + 1]).toBe("scaled: 1.5");
  });

  it("omits the subtitle block entirely when absent", () => {
    const md2 = serializeRecipe({ ...recipe, subtitle: undefined }, fm);
    expect(md2).toContain("# Gochujang-Glazed Pork Belly\n\n## Ingredients");
  });

  it("emits a Notes section when notes are present", () => {
    const md2 = serializeRecipe(
      { ...recipe, notes: ["Use Korean-brand gochujang.", "Marinate up to 48 hours."] },
      fm,
    );
    expect(md2).toContain(
      "## Notes\n- Use Korean-brand gochujang.\n- Marinate up to 48 hours.\n\n---\n",
    );
  });

  it("uses the five-character middle-dot separator", () => {
    expect(md).toContain(`- 800 g${SEP}pork belly`);
    expect(SEP.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/markdown.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/markdown'`.

- [ ] **Step 3: Write the implementation**

Create `extension/src/lib/markdown.ts`:

```ts
import type { Frontmatter, Recipe } from "./types";

/** Two spaces, middle-dot (U+00B7), two spaces. Five characters. */
export const SEPARATOR = "  ·  ";

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

export function serializeRecipe(recipe: Recipe, fm: Frontmatter): string {
  const lines: string[] = [];

  // 1–3: frontmatter, in the spec's mandatory field order.
  lines.push("---");
  lines.push(`ticket: ${formatTicket(fm.ticket)}`);
  lines.push(`captured: ${formatCaptured(fm.captured)}`);
  lines.push(`source: ${fm.source}`);
  lines.push(`via: ${fm.via}`);
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
  lines.push(recipe.tags.join(SEPARATOR));
  lines.push("");
  lines.push(FOOTER);

  // Files end with "mise.app\n", not "mise.app\n\n".
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/markdown.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/markdown.ts extension/tests/markdown.test.ts
git commit -m "feat(mise): serialize Recipe to the .md artifact format"
```

---

### Task 3: Tag sanitization and the v1 taxonomy

**Files:**
- Create: `extension/src/lib/tags.ts`
- Create: `extension/tests/tags.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `sanitizeTag(raw: string): string`, `normalizeTags(raw: string[], handsOn?: string): string[]`, and the exported constant `TAXONOMY` used by Task 6 to build the extraction prompt.

- [ ] **Step 1: Write the failing test**

Create `extension/tests/tags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeTag, normalizeTags } from "../src/lib/tags";

describe("sanitizeTag", () => {
  it("lowercases and kebab-cases multi-word values", () => {
    expect(sanitizeTag("Slow Cooker")).toBe("#slow-cooker");
    expect(sanitizeTag("slow_cooker")).toBe("#slow-cooker");
    expect(sanitizeTag("slowCooker")).toBe("#slow-cooker");
  });

  it("preserves namespaces and kebab-cases only the value", () => {
    expect(sanitizeTag("Cuisine/South Korean")).toBe("#cuisine/south-korean");
  });

  it("is idempotent on an already-sanitized tag", () => {
    expect(sanitizeTag("#cuisine/korean")).toBe("#cuisine/korean");
  });

  it("strips characters that cannot appear in a tag", () => {
    expect(sanitizeTag("gluten free!")).toBe("#gluten-free");
    expect(sanitizeTag("  spaced  out  ")).toBe("#spaced-out");
  });
});

describe("normalizeTags", () => {
  it("dedupes while preserving first-seen order", () => {
    expect(normalizeTags(["#pork", "Pork", "#braise"])).toEqual(["#pork", "#braise"]);
  });

  it("drops empties", () => {
    expect(normalizeTags(["#pork", "", "   ", "!!!"])).toEqual(["#pork"]);
  });

  it("adds #weeknight when hands_on is 45m or under", () => {
    expect(normalizeTags(["#pork"], "25m")).toContain("#weeknight");
    expect(normalizeTags(["#pork"], "45m")).toContain("#weeknight");
    expect(normalizeTags(["#pork"], "1h 10m")).not.toContain("#weeknight");
  });

  it("does not duplicate #weeknight when the model already supplied it", () => {
    const tags = normalizeTags(["#pork", "#weeknight"], "25m");
    expect(tags.filter((t) => t === "#weeknight")).toHaveLength(1);
  });

  it("caps at five tags", () => {
    expect(normalizeTags(["#a", "#b", "#c", "#d", "#e", "#f", "#g"])).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/tags.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/tags'`.

- [ ] **Step 3: Write the implementation**

Create `extension/src/lib/tags.ts`:

```ts
/** The opinionated v1 taxonomy — docs/mise-md-format.md § Taxonomy. */
export const TAXONOMY = {
  cuisine: "#cuisine/* — korean, italian, french, japanese, mexican, …",
  ingredient:
    "#pork #chicken #beef #fish #lamb #egg #tofu #mushroom #legume #grain #vegetable",
  technique:
    "#braise #grill #roast #stir-fry #raw #bake #no-cook #pressure #slow #steam #deep-fry",
  time: "#weeknight #weekend #make-ahead",
  dietary: "#vegetarian #vegan #gluten-free #dairy-free #nut-free (only when confidently true)",
} as const;

const MAX_TAGS = 5;

/** Minutes of hands-on time at or below which a recipe is a #weeknight. */
const WEEKNIGHT_CEILING_MINUTES = 45;

function kebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // slowCooker -> slow-Cooker
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Lowercase, kebab-case, namespace-preserving. Returns "" if nothing survives. */
export function sanitizeTag(raw: string): string {
  const bare = raw.trim().replace(/^#/, "");
  if (!bare) return "";
  const slash = bare.indexOf("/");
  if (slash === -1) {
    const value = kebab(bare);
    return value ? `#${value}` : "";
  }
  const ns = kebab(bare.slice(0, slash));
  const value = kebab(bare.slice(slash + 1));
  if (!ns || !value) return "";
  return `#${ns}/${value}`;
}

/** Parse "1h 10m" / "25m" / "2h" into minutes. Returns null if unparseable. */
export function parseDuration(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

/**
 * Sanitize, dedupe, apply the #weeknight time bucket, and cap at five.
 * Mise targets 3–5 tags per recipe.
 */
export function normalizeTags(raw: string[], handsOn?: string): string[] {
  const out: string[] = [];
  for (const tag of raw) {
    const clean = sanitizeTag(tag);
    if (clean && !out.includes(clean)) out.push(clean);
  }

  if (handsOn) {
    const minutes = parseDuration(handsOn);
    if (minutes !== null && minutes <= WEEKNIGHT_CEILING_MINUTES && !out.includes("#weeknight")) {
      out.push("#weeknight");
    }
  }

  return out.slice(0, MAX_TAGS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/tags.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/tags.ts extension/tests/tags.test.ts
git commit -m "feat(mise): tag sanitization and v1 taxonomy"
```

---

### Task 4: Storage — API key, preferences, ticket counter, The Pass

**Files:**
- Create: `extension/src/lib/storage.ts`
- Create: `extension/tests/storage.test.ts`
- Create: `extension/tests/helpers/chrome-mock.ts`

**Interfaces:**
- Consumes: `Ticket`, `Units` from `src/lib/types.ts`.
- Produces: `getSettings()`, `setSettings(patch)`, `nextTicket()`, `listTickets()`, `saveTicket(ticket)`, `clearPass()`, and the `Settings` interface `{ apiKey: string; units: Units; model: string; captureFrames: boolean }`.

- [ ] **Step 1: Write the chrome.storage mock**

Create `extension/tests/helpers/chrome-mock.ts`:

```ts
import { vi } from "vitest";

/** Minimal in-memory chrome.storage.local, installed on globalThis. */
export function installChromeMock(seed: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...seed };
  const local = {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys == null) return { ...store };
      if (typeof keys === "string") return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((k) => [k, store[k]]));
      }
      return Object.fromEntries(
        Object.entries(keys).map(([k, fallback]) => [k, store[k] ?? fallback]),
      );
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store, items);
    },
    async remove(key: string) {
      delete store[key];
    },
  };
  vi.stubGlobal("chrome", { storage: { local } });
  return store;
}
```

- [ ] **Step 2: Write the failing test**

Create `extension/tests/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import {
  getSettings,
  setSettings,
  nextTicket,
  saveTicket,
  listTickets,
  clearPass,
} from "../src/lib/storage";
import type { Ticket } from "../src/lib/types";

const ticket = (n: number): Ticket => ({
  frontmatter: {
    ticket: n,
    captured: "2026-04-22T16:28",
    source: "https://example.com",
    via: "article text",
  },
  recipe: {
    title: `Recipe ${n}`,
    serves: "4",
    ingredients: [{ qty: "1", item: "thing" }],
    method: ["do it"],
    tags: ["#pork"],
  },
});

beforeEach(() => {
  vi.unstubAllGlobals();
  installChromeMock();
});

describe("settings", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual({
      apiKey: "",
      units: "metric",
      model: "claude-haiku-4-5",
      captureFrames: true,
    });
  });

  it("merges a patch without clobbering other fields", async () => {
    await setSettings({ apiKey: "sk-ant-test" });
    await setSettings({ units: "imperial" });
    const settings = await getSettings();
    expect(settings.apiKey).toBe("sk-ant-test");
    expect(settings.units).toBe("imperial");
    expect(settings.model).toBe("claude-haiku-4-5");
  });
});

describe("nextTicket", () => {
  it("starts at 1 and increments monotonically", async () => {
    expect(await nextTicket()).toBe(1);
    expect(await nextTicket()).toBe(2);
    expect(await nextTicket()).toBe(3);
  });

  it("wraps back to 1 after 99999", async () => {
    installChromeMock({ "mise:counter": 99999 });
    expect(await nextTicket()).toBe(1);
  });
});

describe("The Pass", () => {
  it("returns an empty list before anything is fired", async () => {
    expect(await listTickets()).toEqual([]);
  });

  it("stores newest first", async () => {
    await saveTicket(ticket(1));
    await saveTicket(ticket(2));
    const tickets = await listTickets();
    expect(tickets.map((t) => t.frontmatter.ticket)).toEqual([2, 1]);
  });

  it("caps history at 500 entries, dropping the oldest", async () => {
    for (let i = 1; i <= 505; i++) await saveTicket(ticket(i));
    const tickets = await listTickets();
    expect(tickets).toHaveLength(500);
    expect(tickets[0]!.frontmatter.ticket).toBe(505);
    expect(tickets.at(-1)!.frontmatter.ticket).toBe(6);
  });

  it("clears", async () => {
    await saveTicket(ticket(1));
    await clearPass();
    expect(await listTickets()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/storage.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/storage'`.

- [ ] **Step 4: Write the implementation**

Create `extension/src/lib/storage.ts`:

```ts
import type { Ticket, Units } from "./types";

const KEY_SETTINGS = "mise:settings";
const KEY_COUNTER = "mise:counter";
const KEY_PASS = "mise:pass";

/** Tickets are 5-digit; roll over rather than overflow the format. */
const MAX_TICKET = 99999;

/** chrome.storage.local gives ~10MB per origin. 500 tickets stays well inside it. */
const MAX_HISTORY = 500;

export interface Settings {
  apiKey: string;
  units: Units;
  model: string;
  captureFrames: boolean;
}

const DEFAULTS: Settings = {
  apiKey: "",
  units: "metric",
  model: "claude-haiku-4-5",
  captureFrames: true,
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY_SETTINGS);
  return { ...DEFAULTS, ...(stored[KEY_SETTINGS] as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: next });
}

/** Device-local counter, incremented per capture. */
export async function nextTicket(): Promise<number> {
  const stored = await chrome.storage.local.get(KEY_COUNTER);
  const current = (stored[KEY_COUNTER] as number | undefined) ?? 0;
  const next = current >= MAX_TICKET ? 1 : current + 1;
  await chrome.storage.local.set({ [KEY_COUNTER]: next });
  return next;
}

/** The Pass — what's come across the pass, newest first. */
export async function listTickets(): Promise<Ticket[]> {
  const stored = await chrome.storage.local.get(KEY_PASS);
  return (stored[KEY_PASS] as Ticket[] | undefined) ?? [];
}

export async function saveTicket(ticket: Ticket): Promise<void> {
  const tickets = [ticket, ...(await listTickets())].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [KEY_PASS]: tickets });
}

export async function clearPass(): Promise<void> {
  await chrome.storage.local.set({ [KEY_PASS]: [] });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/storage.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 6: Commit**

```bash
git add extension/src/lib/storage.ts extension/tests/storage.test.ts extension/tests/helpers
git commit -m "feat(mise): storage layer — settings, ticket counter, The Pass"
```

---

### Task 5: Content script — page extraction

Decides *what* to send the model and *which* `via` label the capture earns.

**Files:**
- Create: `extension/src/content/extract.ts`
- Create: `extension/src/lib/page-source.ts`
- Create: `extension/tests/page-source.test.ts`

**Interfaces:**
- Consumes: `ViaMethod` from `src/lib/types.ts`.
- Produces: `ExtractionPayload { via: ViaMethod; text: string; source: string; title: string; hasVideo: boolean }` and `pickSource(doc: Document, url: string): ExtractionPayload`. The content script responds to a `{ type: "mise:extract" }` runtime message with an `ExtractionPayload`.

- [ ] **Step 1: Write the failing test**

Create `extension/tests/page-source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickSource, JSON_LD_SELECTOR } from "../src/lib/page-source";

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("pickSource", () => {
  it("prefers schema.org/Recipe JSON-LD and labels it 'schema data'", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":"Recipe","name":"Kimchi Jjigae","recipeYield":"4"}
    </script></head><body><p>ignored prose</p></body></html>`);
    const payload = pickSource(doc, "https://example.com/r/1");
    expect(payload.via).toBe("schema data");
    expect(payload.text).toContain("Kimchi Jjigae");
    expect(payload.text).not.toContain("ignored prose");
  });

  it("finds Recipe inside an @graph array", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Bibimbap"}]}
    </script></head><body></body></html>`);
    expect(pickSource(doc, "https://example.com").via).toBe("schema data");
    expect(pickSource(doc, "https://example.com").text).toContain("Bibimbap");
  });

  it("ignores non-Recipe JSON-LD and falls through to article text", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":"BreadcrumbList"}
    </script></head><body><article>${"Cook the thing. ".repeat(30)}</article></body></html>`);
    const payload = pickSource(doc, "https://example.com");
    expect(payload.via).toBe("article text");
    expect(payload.text).toContain("Cook the thing.");
  });

  it("labels a short-text page carrying a video as 'caption only'", () => {
    const doc = docFrom(
      `<html><body><video src="blob:x"></video><p>Quick pasta: garlic, chilli, oil.</p></body></html>`,
    );
    const payload = pickSource(doc, "https://instagram.com/p/C9xK2");
    expect(payload.via).toBe("caption only");
    expect(payload.hasVideo).toBe(true);
  });

  it("reports hasVideo false on a plain article", () => {
    const doc = docFrom(`<html><body><article>${"Prose. ".repeat(50)}</article></body></html>`);
    expect(pickSource(doc, "https://example.com").hasVideo).toBe(false);
  });

  it("carries the source URL and document title through", () => {
    const doc = docFrom(`<html><head><title>Best Ragu</title></head>
      <body><article>${"Simmer. ".repeat(40)}</article></body></html>`);
    const payload = pickSource(doc, "https://example.com/ragu");
    expect(payload.source).toBe("https://example.com/ragu");
    expect(payload.title).toBe("Best Ragu");
  });

  it("exports the JSON-LD selector it uses", () => {
    expect(JSON_LD_SELECTOR).toBe('script[type="application/ld+json"]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/page-source.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/page-source'`.

Note: this test needs a DOM. Set `environment: "happy-dom"` for it by adding `// @vitest-environment happy-dom` at the top of the test file, and `npm install --save-dev happy-dom`.

- [ ] **Step 3: Write the implementation**

Create `extension/src/lib/page-source.ts`:

```ts
import { Readability } from "@mozilla/readability";
import type { ViaMethod } from "./types";

export const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

/** Below this, prose is a caption rather than an article. */
const CAPTION_CEILING = 400;

/** Claude gets plenty of signal well before a full long-form blog. */
const TEXT_CAP = 24_000;

export interface ExtractionPayload {
  via: ViaMethod;
  text: string;
  source: string;
  title: string;
  hasVideo: boolean;
}

function isRecipeNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const type = (node as { "@type"?: unknown })["@type"];
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

/** Walk a JSON-LD document (bare object, array, or @graph) for a Recipe node. */
function findRecipeNode(parsed: unknown): unknown | null {
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const hit = findRecipeNode(entry);
      if (hit) return hit;
    }
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (isRecipeNode(parsed)) return parsed;
  const graph = (parsed as { "@graph"?: unknown })["@graph"];
  return graph ? findRecipeNode(graph) : null;
}

function readJsonLdRecipe(doc: Document): string | null {
  for (const script of Array.from(doc.querySelectorAll(JSON_LD_SELECTOR))) {
    try {
      const node = findRecipeNode(JSON.parse(script.textContent ?? ""));
      if (node) return JSON.stringify(node);
    } catch {
      // A malformed ld+json block is common in the wild — skip it, try the next.
    }
  }
  return null;
}

function readArticle(doc: Document): string {
  // Readability mutates the document it parses, so hand it a clone.
  const parsed = new Readability(doc.cloneNode(true) as Document).parse();
  const text = parsed?.textContent ?? doc.body?.textContent ?? "";
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function pickSource(doc: Document, url: string): ExtractionPayload {
  const title = doc.title ?? "";
  const hasVideo = doc.querySelector("video") !== null;

  const schema = readJsonLdRecipe(doc);
  if (schema) {
    return { via: "schema data", text: schema.slice(0, TEXT_CAP), source: url, title, hasVideo };
  }

  const article = readArticle(doc);
  const via: ViaMethod =
    hasVideo && article.length < CAPTION_CEILING ? "caption only" : "article text";

  return { via, text: article.slice(0, TEXT_CAP), source: url, title, hasVideo };
}
```

Create `extension/src/content/extract.ts`:

```ts
import { pickSource } from "../lib/page-source";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "mise:extract") return false;
  try {
    sendResponse({ ok: true, payload: pickSource(document, location.href) });
  } catch (error) {
    sendResponse({ ok: false, error: (error as Error).message });
  }
  return true; // keep the channel open for the async response
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/page-source.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add extension/src/content extension/src/lib/page-source.ts extension/tests/page-source.test.ts
git commit -m "feat(mise): content-script page extraction with via-method detection"
```

---

### Task 6: Anthropic extraction client

**Files:**
- Create: `extension/src/lib/anthropic.ts`
- Create: `extension/tests/anthropic.test.ts`

**Interfaces:**
- Consumes: `Recipe`, `Units` from `src/lib/types.ts`; `ExtractionPayload` from `src/lib/page-source.ts`; `normalizeTags`, `TAXONOMY` from `src/lib/tags.ts`.
- Produces: `RECIPE_SCHEMA` (the JSON Schema passed to `output_config.format`), `buildPrompt(payload, units)`, `extractRecipe(payload, opts): Promise<Recipe>`, and the error class `OffMenuError` (thrown when the page carries no recipe).

- [ ] **Step 1: Write the failing test**

Create `extension/tests/anthropic.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { RECIPE_SCHEMA, buildPrompt, extractRecipe, OffMenuError } from "../src/lib/anthropic";
import type { ExtractionPayload } from "../src/lib/page-source";

const payload: ExtractionPayload = {
  via: "article text",
  text: "Gochujang pork belly. 800g pork belly. Roast 90 minutes.",
  source: "https://example.com/pork",
  title: "Gochujang Pork Belly",
  hasVideo: false,
};

describe("RECIPE_SCHEMA", () => {
  it("is a strict object schema", () => {
    expect(RECIPE_SCHEMA.type).toBe("object");
    expect(RECIPE_SCHEMA.additionalProperties).toBe(false);
  });

  it("requires the fields the .md format cannot omit", () => {
    expect(RECIPE_SCHEMA.required).toEqual([
      "found",
      "title",
      "serves",
      "ingredients",
      "method",
      "tags",
    ]);
  });

  it("shapes ingredients as qty/item pairs", () => {
    const item = RECIPE_SCHEMA.properties.ingredients.items;
    expect(Object.keys(item.properties).sort()).toEqual(["item", "qty"]);
    expect(item.additionalProperties).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("states the target unit system", () => {
    expect(buildPrompt(payload, "imperial")).toContain("imperial");
    expect(buildPrompt(payload, "metric")).toContain("metric");
  });

  it("includes the page text and source", () => {
    const prompt = buildPrompt(payload, "metric");
    expect(prompt).toContain("800g pork belly");
    expect(prompt).toContain("https://example.com/pork");
  });

  it("instructs conversion by ingredient density, not naive math", () => {
    expect(buildPrompt(payload, "metric")).toMatch(/density|weight/i);
  });
});

describe("extractRecipe", () => {
  function clientReturning(parsed: unknown) {
    return {
      messages: {
        parse: vi.fn().mockResolvedValue({ parsed_output: parsed }),
      },
    } as never;
  }

  it("returns a Recipe with normalized tags", async () => {
    const client = clientReturning({
      found: true,
      title: "Gochujang Pork Belly",
      serves: "4",
      hands_on: "25m",
      ingredients: [{ qty: "800 g", item: "pork belly" }],
      method: ["Roast."],
      tags: ["Pork", "pork", "Slow Cooker"],
    });
    const recipe = await extractRecipe(payload, { client, units: "metric", model: "m" });
    expect(recipe.title).toBe("Gochujang Pork Belly");
    // deduped, kebab-cased, and #weeknight added from hands_on: 25m
    expect(recipe.tags).toEqual(["#pork", "#slow-cooker", "#weeknight"]);
  });

  it("throws OffMenuError when the model reports no recipe", async () => {
    const client = clientReturning({ found: false, title: "", serves: "", ingredients: [], method: [], tags: [] });
    await expect(
      extractRecipe(payload, { client, units: "metric", model: "m" }),
    ).rejects.toBeInstanceOf(OffMenuError);
  });

  it("throws OffMenuError when the recipe has no ingredients", async () => {
    const client = clientReturning({
      found: true, title: "Nothing", serves: "1", ingredients: [], method: ["x"], tags: [],
    });
    await expect(
      extractRecipe(payload, { client, units: "metric", model: "m" }),
    ).rejects.toBeInstanceOf(OffMenuError);
  });

  it("throws when structured output fails to parse", async () => {
    const client = clientReturning(null);
    await expect(
      extractRecipe(payload, { client, units: "metric", model: "m" }),
    ).rejects.toThrow(/structured output/i);
  });

  it("sends frames as image blocks when provided", async () => {
    const client = clientReturning({
      found: true, title: "T", serves: "2",
      ingredients: [{ qty: "1", item: "x" }], method: ["y"], tags: ["#pork"],
    });
    await extractRecipe(
      { ...payload, via: "2 video frames" },
      { client, units: "metric", model: "m", frames: ["AAA", "BBB"] },
    );
    const args = (client as never as { messages: { parse: ReturnType<typeof vi.fn> } })
      .messages.parse.mock.calls[0]![0];
    const blocks = args.messages[0].content;
    expect(blocks.filter((b: { type: string }) => b.type === "image")).toHaveLength(2);
    expect(blocks.at(-1).type).toBe("text");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/anthropic.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/anthropic'`.

- [ ] **Step 3: Write the implementation**

Create `extension/src/lib/anthropic.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { normalizeTags, TAXONOMY } from "./tags";
import type { ExtractionPayload } from "./page-source";
import type { Recipe, Units } from "./types";

/** The page has no recipe on it — the Off Menu state, not a failure. */
export class OffMenuError extends Error {
  constructor() {
    super("No recipe on this page.");
    this.name = "OffMenuError";
  }
}

/**
 * Structured-output schema. `found` lets the model say "no recipe here"
 * without inventing one — the Off Menu state depends on it.
 */
export const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "title", "serves", "ingredients", "method", "tags"],
  properties: {
    found: { type: "boolean", description: "False if the page carries no recipe." },
    title: { type: "string", description: "Normal case, one line, no trailing punctuation." },
    subtitle: { type: "string", description: "One-line description. Omit if the source gives none." },
    serves: { type: "string", description: 'e.g. "4", "makes 12", "serves 6-8".' },
    hands_on: { type: "string", description: 'Active time at the counter, e.g. "25m". Excludes passive waits.' },
    total: { type: "string", description: 'Total elapsed time including passive waits, e.g. "2h 10m".' },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["qty", "item"],
        properties: {
          qty: { type: "string", description: 'Number and unit, space-separated ("800 g"). Em-dash "—" if unmeasured.' },
          item: { type: "string", description: "Lowercase prose with brief modifiers." },
        },
      },
    },
    method: { type: "array", items: { type: "string" }, description: "Flat prose steps, no sub-bullets." },
    notes: { type: "array", items: { type: "string" }, description: "Only genuine extra context. Omit rather than pad." },
    tags: { type: "array", items: { type: "string" } },
  },
} as const;

export function buildPrompt(payload: ExtractionPayload, units: Units): string {
  const temperature = units === "metric" ? "°C" : "°F";
  return `Extract the recipe from this ${payload.via === "schema data" ? "schema.org/Recipe JSON" : "page content"}.

SOURCE: ${payload.source}
PAGE TITLE: ${payload.title}

Rules:
- Output ${units} units throughout, temperatures in ${temperature}.
- Convert by ingredient density, not naive math: "⅓ cup" becomes "80 ml", "1 cup flour" becomes "125 g flour" (weight is preferred for baking). Round to culturally natural increments — use vulgar fractions (½, ⅓, ¼, ¾) rather than decimals where a cook would.
- Quantities put a space between number and unit. Use the em-dash "—" as the quantity for finishing garnishes with no measurable amount.
- Ingredient items are lowercase prose; brief modifiers like "crushed" or "skin-on" are welcome.
- Method steps are flat prose. If the source nests sub-steps, flatten them into one paragraph with em-dashes or semicolons.
- Notes are only for genuine extra context — substitutions, source tips, provenance. Omit the field rather than padding it.
- Give 3–5 tags from this taxonomy: cuisine ${TAXONOMY.cuisine}; main ingredient ${TAXONOMY.ingredient}; technique ${TAXONOMY.technique}; dietary ${TAXONOMY.dietary}. Do not add time-bucket tags — those are computed.
- If this page carries no recipe, set found to false and leave the other fields empty. Never invent a recipe.

CONTENT:
${payload.text}`;
}

export interface ExtractOptions {
  client: Anthropic;
  units: Units;
  model: string;
  /** Base64-encoded JPEG frames, already downsampled to <=1568px on the long edge. */
  frames?: string[];
}

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
  });
}

export async function extractRecipe(
  payload: ExtractionPayload,
  { client, units, model, frames = [] }: ExtractOptions,
): Promise<Recipe> {
  const content = [
    ...frames.map((data) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
    })),
    { type: "text" as const, text: buildPrompt(payload, units) },
  ];

  // Haiku 4.5 supports structured outputs and vision, but not effort or
  // adaptive thinking — do not send either.
  const response = await client.messages.parse({
    model,
    max_tokens: 8000,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
  });

  const parsed = response.parsed_output as
    | (Recipe & { found: boolean })
    | null
    | undefined;

  if (!parsed) throw new Error("Claude returned no structured output.");
  if (!parsed.found || parsed.ingredients.length === 0) throw new OffMenuError();

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    serves: parsed.serves,
    hands_on: parsed.hands_on,
    total: parsed.total,
    ingredients: parsed.ingredients,
    method: parsed.method,
    notes: parsed.notes,
    tags: normalizeTags(parsed.tags, parsed.hands_on),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/anthropic.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/anthropic.ts extension/tests/anthropic.test.ts
git commit -m "feat(mise): BYOK Claude extraction with structured-output recipe schema"
```

---

### Task 7: Popup shell — port the design system

No new design decisions. Lift the locked CSS out of the specimen and drop the gallery chrome.

**Files:**
- Create: `extension/src/popup/popup.html`
- Create: `extension/src/popup/popup.css`
- Create: `extension/src/popup/render.ts`
- Create: `extension/tests/render.test.ts`

**Interfaces:**
- Consumes: `Recipe`, `Frontmatter` from `src/lib/types.ts`; `formatTicket`, `formatCaptured` from `src/lib/markdown.ts`.
- Produces: `renderCard(recipe, fm): string` (the filled card's inner HTML), `renderSkeleton(): string`, `renderStamp(kind: "fired" | "error" | "offmenu"): string`.

- [ ] **Step 1: Port the CSS**

Copy `type-specimens/popup-states.html` lines 9–104 (the `@font-face` blocks and the `:root` token block) and lines 250–1030 (every `.popup ...` rule, skeleton primitives, filmstrip, stamps, empty state, picker, fired overlay, and action row) into `extension/src/popup/popup.css`. Then:

- Drop the gallery-only rules: `.page`, `.page-head`, `.variant-grid`, `.status legend`, `.popup-frame` (the specimen's card-spacing wrapper).
- Rewrite the four `@font-face` `src` URLs from `./fonts/...` to `../fonts/...` (the build copies fonts to `dist/fonts`, and the popup lives in `dist/popup`).
- Append this popup-window chrome, which the specimen did not need:

```css
/* ─── Popup window (extension-only) ───────────────────────────── */
html, body {
  width: 400px;
  margin: 0;
  background: var(--bg-page);
}

body {
  /* MV3 caps popup height at 600px. The card scrolls; the action row is pinned. */
  max-height: 600px;
  display: flex;
  flex-direction: column;
}

.popup {
  border: 0;
  box-shadow: none;
  overflow-y: auto;
  flex: 1 1 auto;
}

.action-row { flex: 0 0 auto; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Write the popup HTML**

Create `extension/src/popup/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mise</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <main class="popup" id="card" aria-live="polite" aria-busy="true"></main>
    <div class="action-row">
      <button id="fire" class="btn-fire" type="button" disabled>FIRE &middot; save .md</button>
      <button id="prep" class="btn-secondary" type="button">Prep</button>
      <a id="pass" class="btn-secondary" href="../pass/pass.html" target="_blank">The Pass</a>
    </div>
    <script type="module" src="popup.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Write the failing test**

Create `extension/tests/render.test.ts` (add `// @vitest-environment happy-dom` at the top):

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderCard, renderSkeleton, renderStamp } from "../src/popup/render";
import type { Recipe, Frontmatter } from "../src/lib/types";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  subtitle: "slow-rendered, sharply-sauced.",
  serves: "4",
  hands_on: "25m",
  total: "2h 10m",
  ingredients: [
    { qty: "800 g", item: "pork belly, skin-on" },
    { qty: "—", item: "spring onion to finish" },
  ],
  method: ["Score the skin.", "Roast at 160 °C."],
  tags: ["#cuisine/korean", "#pork"],
};

const fm: Frontmatter = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://instagram.com/p/C9xK2",
  via: "8 video frames",
};

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

describe("renderCard", () => {
  const doc = parse(renderCard(recipe, fm));

  it("renders the ticket-top with the NO. display convention", () => {
    expect(doc.querySelector(".ticket-top .brand")!.textContent).toContain("NO. 00427");
  });

  it("shows the source domain, not the full URL", () => {
    expect(doc.querySelector(".source .url")!.textContent!.trim()).toBe("instagram.com");
  });

  it("labels the facts row with SERVES / HANDS-ON / TOTAL", () => {
    const labels = [...doc.querySelectorAll(".facts .label")].map((n) => n.textContent);
    expect(labels).toEqual(["SERVES", "HANDS-ON", "TOTAL"]);
  });

  it("uses semantic list markup for ingredients and method", () => {
    expect(doc.querySelector("ul.ingredients")).not.toBeNull();
    expect(doc.querySelector("ol.method")).not.toBeNull();
    expect(doc.querySelectorAll("ul.ingredients li")).toHaveLength(2);
    expect(doc.querySelectorAll("ol.method li")).toHaveLength(2);
  });

  it("uses a real heading for the title", () => {
    expect(doc.querySelector("h1.title")!.textContent).toBe("Gochujang-Glazed Pork Belly");
  });

  it("escapes HTML in model output", () => {
    const evil = parse(renderCard({ ...recipe, title: "<img src=x onerror=alert(1)>" }, fm));
    expect(evil.querySelector("img")).toBeNull();
    expect(evil.querySelector("h1.title")!.textContent).toContain("<img");
  });

  it("omits the subtitle and notes blocks when absent", () => {
    const bare = parse(renderCard({ ...recipe, subtitle: undefined }, fm));
    expect(bare.querySelector(".subtitle")).toBeNull();
    expect(bare.querySelector(".notes")).toBeNull();
  });

  it("renders the tag line and footer", () => {
    expect(doc.querySelector(".tagline")!.textContent).toContain("#cuisine/korean");
    expect(doc.querySelector(".ticket-bottom")!.textContent).toContain("✶ mise.app");
  });
});

describe("renderSkeleton", () => {
  it("emits skeleton bars and no recipe content", () => {
    const doc = parse(renderSkeleton());
    expect(doc.querySelectorAll(".skeleton-bar").length).toBeGreaterThan(0);
    expect(doc.querySelector("ul.ingredients")).toBeNull();
  });
});

describe("renderStamp", () => {
  it("uses the locked stamp labels", () => {
    expect(renderStamp("fired")).toContain("FIRED");
    expect(renderStamp("error")).toContain("KITCHEN ERROR");
    expect(renderStamp("offmenu")).toContain("OFF MENU");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/render.test.ts`
Expected: FAIL — `Cannot find module '../src/popup/render'`.

- [ ] **Step 5: Write the renderer**

Create `extension/src/popup/render.ts`:

```ts
import { formatCaptured, formatTicket, FOOTER } from "../lib/markdown";
import type { Frontmatter, Recipe } from "../lib/types";

/** Model output is untrusted text — never interpolate it raw. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Source-type badge glyphs are content, not chrome — emoji are allowed here. */
function viaBadge(via: string): string {
  const glyph = via.endsWith("video frames") ? "🎬" : via === "schema data" ? "📜" : "📝";
  return `${glyph} ${via.toUpperCase()}`;
}

function factsRow(recipe: Recipe): string {
  const facts: Array<[string, string | undefined]> = [
    ["SERVES", recipe.serves],
    ["HANDS-ON", recipe.hands_on],
    ["TOTAL", recipe.total],
  ];
  const cells = facts
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) =>
        `<div class="fact"><span class="label">${label}</span><span class="value">${esc(value!)}</span></div>`,
    )
    .join("");
  return `<div class="facts">${cells}</div>`;
}

export function renderCard(recipe: Recipe, fm: Frontmatter): string {
  const captured = formatCaptured(fm.captured);
  return `
    <header class="ticket-top">
      <span class="brand">MISE &middot; NO. ${formatTicket(fm.ticket)}</span>
      <span class="captured">${captured.replace("T", " ")}</span>
    </header>
    <div class="source">
      <span class="url">${esc(domainOf(fm.source))}</span>
      <span class="badge">${esc(viaBadge(fm.via))}</span>
    </div>
    <h1 class="title">${esc(recipe.title)}</h1>
    ${recipe.subtitle ? `<p class="subtitle">${esc(recipe.subtitle)}</p>` : ""}
    ${factsRow(recipe)}
    <h2 class="section">Ingredients</h2>
    <ul class="ingredients">
      ${recipe.ingredients
        .map(
          ({ qty, item }) =>
            `<li><span class="qty">${esc(qty)}</span><span class="item">${esc(item)}</span></li>`,
        )
        .join("")}
    </ul>
    <h2 class="section">Method</h2>
    <ol class="method">
      ${recipe.method.map((step) => `<li>${esc(step)}</li>`).join("")}
    </ol>
    ${
      recipe.notes?.length
        ? `<h2 class="section">Notes</h2><ul class="notes">${recipe.notes
            .map((note) => `<li>${esc(note)}</li>`)
            .join("")}</ul>`
        : ""
    }
    <p class="tagline">${recipe.tags.map(esc).join("  &middot;  ")}</p>
    <footer class="ticket-bottom">
      <span class="captured">${captured.replace("T", " ")}</span>
      <span class="mark">${FOOTER}</span>
    </footer>`;
}

export function renderSkeleton(): string {
  const bar = (width: string) => `<div class="skeleton-bar" style="width:${width}"></div>`;
  return `
    <header class="ticket-top">
      <span class="brand">MISE</span>
      <span class="captured">CAPTURING</span>
    </header>
    <div class="source">
      <span class="url">${bar("60%")}</span>
      <span class="badge pending">READING</span>
    </div>
    <div class="skeleton-body">
      ${bar("85%")}${bar("40%")}${bar("95%")}${bar("70%")}${bar("90%")}${bar("55%")}
    </div>`;
}

const STAMPS = {
  fired: "FIRED",
  error: "KITCHEN ERROR",
  offmenu: "OFF MENU",
} as const;

export function renderStamp(kind: keyof typeof STAMPS): string {
  return `<div class="stamp stamp-${kind}" role="status"><span class="glyph"></span>${STAMPS[kind]}</div>`;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/render.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 7: Commit**

```bash
git add extension/src/popup
git commit -m "feat(mise): port the locked popup design system and card renderer"
```

---

### Task 8: Popup wiring — extract, render, Fire

The peak moment: card materializing *is* the delivery of the artifact.

**Files:**
- Create: `extension/src/popup/popup.ts`
- Create: `extension/src/lib/fire.ts`
- Create: `extension/src/background/service-worker.ts`
- Create: `extension/tests/fire.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces: `fire(recipe, fm): Promise<void>` — serializes, downloads via `chrome.downloads`, and saves to The Pass; `filenameFor(recipe, fm): string`.

- [ ] **Step 1: Write the failing test**

Create `extension/tests/fire.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import { fire, filenameFor } from "../src/lib/fire";
import { listTickets } from "../src/lib/storage";
import type { Recipe, Frontmatter } from "../src/lib/types";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  serves: "4",
  ingredients: [{ qty: "800 g", item: "pork belly" }],
  method: ["Roast."],
  tags: ["#pork"],
};

const fm: Frontmatter = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://example.com/pork",
  via: "article text",
};

describe("filenameFor", () => {
  it("slugs the title and prefixes the ticket number", () => {
    expect(filenameFor(recipe, fm)).toBe("00427-gochujang-glazed-pork-belly.md");
  });

  it("strips characters that are illegal in filenames", () => {
    expect(filenameFor({ ...recipe, title: 'A/B "C": D?' }, fm)).toBe("00427-a-b-c-d.md");
  });

  it("truncates very long titles", () => {
    const name = filenameFor({ ...recipe, title: "word ".repeat(40) }, fm);
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.endsWith(".md")).toBe(true);
  });
});

describe("fire", () => {
  let download: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    const store = installChromeMock();
    download = vi.fn().mockResolvedValue(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.downloads = { download };
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:mise"),
      revokeObjectURL: vi.fn(),
    });
    void store;
  });

  it("downloads the .md under the ticket filename", async () => {
    await fire(recipe, fm);
    expect(download).toHaveBeenCalledWith({
      url: "blob:mise",
      filename: "00427-gochujang-glazed-pork-belly.md",
      saveAs: false,
    });
  });

  it("records the ticket in The Pass", async () => {
    await fire(recipe, fm);
    const tickets = await listTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]!.frontmatter.ticket).toBe(427);
    expect(tickets[0]!.frontmatter.captured).toBe("2026-04-22T16:28");
    expect(tickets[0]!.recipe.title).toBe("Gochujang-Glazed Pork Belly");
  });

  it("revokes the object URL after handing it to chrome.downloads", async () => {
    await fire(recipe, fm);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mise");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/fire.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/fire'`.

- [ ] **Step 3: Write the Fire action**

Create `extension/src/lib/fire.ts`:

```ts
import { formatCaptured, formatTicket, serializeRecipe } from "./markdown";
import { saveTicket } from "./storage";
import type { Frontmatter, Recipe } from "./types";

const MAX_FILENAME = 80;

export function filenameFor(recipe: Recipe, fm: Frontmatter): string {
  const slug = recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const prefix = `${formatTicket(fm.ticket)}-`;
  const budget = MAX_FILENAME - prefix.length - ".md".length;
  return `${prefix}${slug.slice(0, budget).replace(/-$/, "")}.md`;
}

/** Write the .md to disk and record the ticket on The Pass. */
export async function fire(recipe: Recipe, fm: Frontmatter): Promise<void> {
  const markdown = serializeRecipe(recipe, fm);
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  try {
    await chrome.downloads.download({ url, filename: filenameFor(recipe, fm), saveAs: false });
  } finally {
    URL.revokeObjectURL(url);
  }
  await saveTicket({
    frontmatter: { ...fm, captured: formatCaptured(fm.captured) },
    recipe,
  });
}
```

- [ ] **Step 4: Write the popup controller**

Create `extension/src/popup/popup.ts`:

```ts
import { createClient, extractRecipe, OffMenuError } from "../lib/anthropic";
import { fire } from "../lib/fire";
import { getSettings, nextTicket } from "../lib/storage";
import type { ExtractionPayload } from "../lib/page-source";
import type { Frontmatter, Recipe } from "../lib/types";
import { renderCard, renderSkeleton, renderStamp } from "./render";

const card = document.getElementById("card") as HTMLElement;
const fireBtn = document.getElementById("fire") as HTMLButtonElement;
const prepBtn = document.getElementById("prep") as HTMLButtonElement;

let current: { recipe: Recipe; fm: Frontmatter } | null = null;

function showStamp(kind: "fired" | "error" | "offmenu", detail?: string) {
  card.setAttribute("aria-busy", "false");
  card.innerHTML =
    renderStamp(kind) + (detail ? `<p class="stamp-detail">${detail}</p>` : "");
  fireBtn.disabled = true;
}

async function askContentScript(tabId: number): Promise<ExtractionPayload> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/extract.js"],
  });
  const reply = await chrome.tabs.sendMessage(tabId, { type: "mise:extract" });
  if (!reply?.ok) throw new Error(reply?.error ?? "Could not read this page.");
  return reply.payload as ExtractionPayload;
}

async function run() {
  card.innerHTML = renderSkeleton();

  const settings = await getSettings();
  if (!settings.apiKey) {
    showStamp("error", "No API key yet. Open Prep to add one.");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showStamp("error", "No active tab.");
    return;
  }

  try {
    const payload = await askContentScript(tab.id);
    const recipe = await extractRecipe(payload, {
      client: createClient(settings.apiKey),
      units: settings.units,
      model: settings.model,
    });

    const fm: Frontmatter = {
      ticket: await nextTicket(),
      captured: new Date(),
      source: payload.source,
      via: payload.via,
      units: settings.units === "metric" ? undefined : settings.units,
    };

    current = { recipe, fm };
    card.innerHTML = renderCard(recipe, fm);
    card.setAttribute("aria-busy", "false");
    fireBtn.disabled = false;
    fireBtn.focus();
  } catch (error) {
    if (error instanceof OffMenuError) {
      showStamp("offmenu", "Nothing to extract here.");
    } else {
      showStamp("error", (error as Error).message);
    }
  }
}

async function onFire() {
  if (!current) return;
  fireBtn.disabled = true;
  try {
    await fire(current.recipe, current.fm);
    showStamp("fired");
    // The card is speared away; the popup closes behind it.
    setTimeout(() => window.close(), 700);
  } catch (error) {
    showStamp("error", (error as Error).message);
  }
}

fireBtn.addEventListener("click", onFire);
prepBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !fireBtn.disabled) {
    event.preventDefault();
    void onFire();
  }
  if (event.key === "Escape") window.close();
});

void run();
```

- [ ] **Step 5: Write the service worker**

Create `extension/src/background/service-worker.ts`:

```ts
const MENU_ID = "mise-fire-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Fire selected text to Mise",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.selectionText) return;
  // Stash the selection so the popup extracts from it instead of the whole page.
  await chrome.storage.local.set({
    "mise:selection": { text: info.selectionText, source: tab.url ?? "", tabId: tab.id },
  });
  await chrome.action.openPopup();
});
```

- [ ] **Step 6: Run the full test suite**

Run: `cd extension && npx vitest run`
Expected: PASS — all suites green.

- [ ] **Step 7: Build and load the extension**

Run: `npm run build:ext`
Then load `extension/dist/` via `chrome://extensions` → Developer mode → Load unpacked. Add an API key in Prep (Task 9 ships the real page; until then set it from the extension's DevTools console with `chrome.storage.local.set({"mise:settings":{apiKey:"sk-ant-..."}})`). Open a recipe blog and click the toolbar icon.
Expected: skeleton card, then a filled ticket; Enter writes the `.md` to Downloads.

- [ ] **Step 8: Commit**

```bash
git add extension/src
git commit -m "feat(mise): wire the popup — extract, render, Fire to .md"
```

---

### Task 9: Prep — the options page

**Files:**
- Create: `extension/src/prep/prep.html`
- Create: `extension/src/prep/prep.css`
- Create: `extension/src/prep/prep.ts`

**Interfaces:**
- Consumes: `getSettings`, `setSettings` from `src/lib/storage.ts`.
- Produces: nothing other modules import.

- [ ] **Step 1: Write the markup**

Create `extension/src/prep/prep.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mise — Prep</title>
    <link rel="stylesheet" href="prep.css" />
  </head>
  <body>
    <main class="prep">
      <header class="ticket-top">
        <span class="brand">MISE &middot; PREP</span>
      </header>

      <form id="form">
        <label class="field">
          <span class="label">Anthropic API key</span>
          <input id="apiKey" type="password" autocomplete="off" spellcheck="false"
                 placeholder="sk-ant-…" />
          <span class="hint">Stored on this device only. Sent to api.anthropic.com and nowhere else.</span>
        </label>

        <fieldset class="field">
          <legend class="label">Units</legend>
          <label><input type="radio" name="units" value="metric" /> Metric</label>
          <label><input type="radio" name="units" value="imperial" /> Imperial</label>
        </fieldset>

        <label class="field">
          <span class="label">Model</span>
          <select id="model">
            <option value="claude-haiku-4-5">Haiku 4.5 — fast, cheapest per extraction</option>
            <option value="claude-opus-5">Opus 5 — slower, best on messy sources</option>
          </select>
        </label>

        <label class="field checkbox">
          <input id="captureFrames" type="checkbox" />
          <span>Scan video frames on Reels, TikTok, and Shorts</span>
        </label>

        <button type="submit" class="btn-fire">SAVE</button>
        <p id="status" class="status" role="status"></p>
      </form>
    </main>
    <script type="module" src="prep.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the stylesheet**

Create `extension/src/prep/prep.css`. Copy the `@font-face` blocks and `:root` token block from `extension/src/popup/popup.css` (identical, paths already correct at `../fonts/`), then add:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  padding: var(--space-3xl) var(--space-xl);
  background: var(--bg-page);
  color: var(--paper-primary);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.prep {
  max-width: 560px;
  margin: 0 auto;
  background: var(--bg-card);
  color: var(--ink);
  border: 1px solid var(--rule);
}

.prep .ticket-top {
  padding: 14px 18px;
  border-bottom: 1px dashed var(--rule);
}

.prep .ticket-top .brand {
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

form { padding: var(--space-xl) 18px; display: grid; gap: var(--space-xl); }

.field { display: grid; gap: var(--space-sm); border: 0; margin: 0; padding: 0; }

.field .label {
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-secondary);
}

.field input[type="password"],
.field select {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 10px 12px;
  color: var(--ink);
  background: var(--paper-50);
  border: 1px solid var(--rule);
  border-radius: 0;
}

.field input:focus-visible,
.field select:focus-visible,
.btn-fire:focus-visible {
  outline: 2px solid var(--flame);
  outline-offset: 2px;
}

.field .hint { font-family: var(--font-mono); font-size: 11px; color: var(--ink-dim); }

.field.checkbox { grid-auto-flow: column; justify-content: start; align-items: center; gap: var(--space-sm); }

.status { font-family: var(--font-mono); font-size: 11px; color: var(--flame); min-height: 1em; margin: 0; }
```

- [ ] **Step 3: Write the controller**

Create `extension/src/prep/prep.ts`:

```ts
import { getSettings, setSettings } from "../lib/storage";
import type { Units } from "../lib/types";

const form = document.getElementById("form") as HTMLFormElement;
const apiKey = document.getElementById("apiKey") as HTMLInputElement;
const model = document.getElementById("model") as HTMLSelectElement;
const captureFrames = document.getElementById("captureFrames") as HTMLInputElement;
const status = document.getElementById("status") as HTMLElement;

async function load() {
  const settings = await getSettings();
  apiKey.value = settings.apiKey;
  model.value = settings.model;
  captureFrames.checked = settings.captureFrames;
  const radio = form.querySelector<HTMLInputElement>(
    `input[name="units"][value="${settings.units}"]`,
  );
  if (radio) radio.checked = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const units = (new FormData(form).get("units") as Units | null) ?? "metric";
  await setSettings({
    apiKey: apiKey.value.trim(),
    units,
    model: model.value,
    captureFrames: captureFrames.checked,
  });
  status.textContent = "Prepped.";
  setTimeout(() => (status.textContent = ""), 2000);
});

void load();
```

- [ ] **Step 4: Verify manually**

Run: `npm run build:ext`, reload the extension, right-click the toolbar icon → Options.
Expected: the form loads existing settings, saving shows "Prepped.", and reopening shows the saved values.

- [ ] **Step 5: Commit**

```bash
git add extension/src/prep
git commit -m "feat(mise): Prep options page — key, units, model, frame capture"
```

---

### Task 10: The Pass — full-tab history

**Files:**
- Create: `extension/src/pass/pass.html`
- Create: `extension/src/pass/pass.css`
- Create: `extension/src/pass/pass.ts`
- Create: `extension/tests/pass-filter.test.ts`
- Create: `extension/src/lib/pass-filter.ts`

**Interfaces:**
- Consumes: `listTickets`, `clearPass` from `src/lib/storage.ts`; `renderCard` from `src/popup/render.ts`.
- Produces: `filterTickets(tickets, query): Ticket[]`.

- [ ] **Step 1: Write the failing test**

Create `extension/tests/pass-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterTickets } from "../src/lib/pass-filter";
import type { Ticket } from "../src/lib/types";

const make = (n: number, title: string, tags: string[], source: string): Ticket => ({
  frontmatter: { ticket: n, captured: "2026-04-22T16:28", source, via: "article text" },
  recipe: { title, serves: "4", ingredients: [{ qty: "1", item: "x" }], method: ["y"], tags },
});

const tickets = [
  make(3, "Kimchi Jjigae", ["#cuisine/korean", "#pork"], "https://maangchi.com/x"),
  make(2, "Cacio e Pepe", ["#cuisine/italian", "#grain"], "https://example.com/y"),
  make(1, "Pork Ragu", ["#cuisine/italian", "#pork"], "https://example.com/z"),
];

describe("filterTickets", () => {
  it("returns everything for an empty query", () => {
    expect(filterTickets(tickets, "")).toHaveLength(3);
    expect(filterTickets(tickets, "   ")).toHaveLength(3);
  });

  it("matches title case-insensitively", () => {
    expect(filterTickets(tickets, "kimchi").map((t) => t.frontmatter.ticket)).toEqual([3]);
  });

  it("matches tags", () => {
    expect(filterTickets(tickets, "#pork").map((t) => t.frontmatter.ticket)).toEqual([3, 1]);
    expect(filterTickets(tickets, "italian").map((t) => t.frontmatter.ticket)).toEqual([2, 1]);
  });

  it("matches the source domain", () => {
    expect(filterTickets(tickets, "maangchi").map((t) => t.frontmatter.ticket)).toEqual([3]);
  });

  it("matches a ticket number, padded or bare", () => {
    expect(filterTickets(tickets, "00002").map((t) => t.frontmatter.ticket)).toEqual([2]);
    expect(filterTickets(tickets, "2").map((t) => t.frontmatter.ticket)).toEqual([2]);
  });

  it("returns nothing when a query matches nothing", () => {
    expect(filterTickets(tickets, "sourdough")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/pass-filter.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/pass-filter'`.

- [ ] **Step 3: Write the filter**

Create `extension/src/lib/pass-filter.ts`:

```ts
import { formatTicket } from "./markdown";
import type { Ticket } from "./types";

/** Search across title, tags, source, and ticket number. */
export function filterTickets(tickets: Ticket[], query: string): Ticket[] {
  const q = query.trim().toLowerCase();
  if (!q) return tickets;
  return tickets.filter((ticket) => {
    const haystack = [
      ticket.recipe.title,
      ticket.recipe.tags.join(" "),
      ticket.frontmatter.source,
      formatTicket(ticket.frontmatter.ticket),
      String(ticket.frontmatter.ticket),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
```

- [ ] **Step 4: Write the markup**

Create `extension/src/pass/pass.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mise — The Pass</title>
    <link rel="stylesheet" href="pass.css" />
  </head>
  <body>
    <header class="pass-head">
      <h1>THE PASS</h1>
      <input id="search" type="search" placeholder="search tickets" aria-label="Search tickets" />
      <button id="clear" type="button" class="btn-secondary">Clear</button>
    </header>
    <main id="list" class="pass-list" aria-live="polite"></main>
    <script type="module" src="pass.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the stylesheet**

Create `extension/src/pass/pass.css`. Copy the `@font-face` blocks, the `:root` token block, and every `.popup ...` rule from `extension/src/popup/popup.css` (the expanded row reuses the card layout verbatim), then append:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg-page);
  color: var(--paper-primary);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.pass-head {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--space-lg);
  align-items: center;
  padding: var(--space-xl) var(--space-2xl);
  border-bottom: 1px solid var(--rule-dark);
}

.pass-head h1 {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(20px, 3vw, 32px);
  letter-spacing: 0.02em;
  margin: 0;
}

.pass-head input {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 8px 10px;
  min-width: 240px;
  color: var(--paper-primary);
  background: var(--bg-panel);
  border: 1px solid var(--rule-dark);
  border-radius: 0;
}

.pass-list { padding: var(--space-2xl); display: grid; gap: 1px; background: var(--rule-dark); }

.pass-row {
  display: grid;
  grid-template-columns: 6ch 1fr 12ch 18ch;
  gap: var(--space-lg);
  align-items: baseline;
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-page);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  border: 0;
  width: 100%;
  text-align: left;
  color: inherit;
}

.pass-row:hover, .pass-row:focus-visible { background: var(--bg-panel); outline: none; }
.pass-row .no { font-family: var(--font-display); color: var(--paper-muted); }
.pass-row .title { color: var(--paper-primary); }
.pass-row .meta { color: var(--paper-muted); }

.pass-row[aria-expanded="true"] { background: var(--bg-panel); }

.pass-detail { background: var(--bg-page); padding: var(--space-xl); }
.pass-detail .popup { width: 400px; margin: 0 auto; }

.pass-empty {
  background: var(--bg-page);
  padding: var(--space-4xl);
  text-align: center;
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--paper-muted);
}
```

- [ ] **Step 6: Write the controller**

Create `extension/src/pass/pass.ts`:

```ts
import { filterTickets } from "../lib/pass-filter";
import { formatTicket } from "../lib/markdown";
import { clearPass, listTickets } from "../lib/storage";
import { renderCard } from "../popup/render";
import type { Ticket } from "../lib/types";

const list = document.getElementById("list") as HTMLElement;
const search = document.getElementById("search") as HTMLInputElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;

let tickets: Ticket[] = [];
let expanded: number | null = null;

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function draw() {
  const rows = filterTickets(tickets, search.value);

  if (rows.length === 0) {
    list.innerHTML = `<p class="pass-empty">${
      tickets.length === 0 ? "NOTHING ACROSS THE PASS YET" : "NO TICKETS MATCH"
    }</p>`;
    return;
  }

  list.replaceChildren(
    ...rows.flatMap((ticket) => {
      const { frontmatter: fm, recipe } = ticket;
      const isOpen = expanded === fm.ticket;

      const row = document.createElement("button");
      row.type = "button";
      row.className = "pass-row";
      row.setAttribute("aria-expanded", String(isOpen));
      row.innerHTML =
        `<span class="no">${formatTicket(fm.ticket)}</span>` +
        `<span class="title"></span>` +
        `<span class="meta">${fm.captured.slice(0, 10)}</span>` +
        `<span class="meta"></span>`;
      row.querySelector(".title")!.textContent = recipe.title;
      row.querySelectorAll(".meta")[1]!.textContent = domainOf(fm.source);
      row.addEventListener("click", () => {
        expanded = isOpen ? null : fm.ticket;
        draw();
      });

      if (!isOpen) return [row];

      const detail = document.createElement("div");
      detail.className = "pass-detail";
      const card = document.createElement("article");
      card.className = "popup";
      card.innerHTML = renderCard(recipe, { ...fm, captured: new Date(fm.captured) });
      detail.append(card);
      return [row, detail];
    }),
  );
}

search.addEventListener("input", draw);

clearBtn.addEventListener("click", async () => {
  await clearPass();
  tickets = [];
  expanded = null;
  draw();
});

void (async () => {
  tickets = await listTickets();
  draw();
})();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd extension && npx vitest run tests/pass-filter.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 8: Verify manually**

Run `npm run build:ext`, reload, fire two recipes, then open The Pass from the popup.
Expected: two rows newest-first; clicking one expands the full card in place; search filters; Clear empties it.

- [ ] **Step 9: Commit**

```bash
git add extension/src/pass extension/src/lib/pass-filter.ts extension/tests/pass-filter.test.ts
git commit -m "feat(mise): The Pass — history list, search, in-place card expansion"
```

---

### Task 11: Video frame capture

Level 2. The popup drives capture because `chrome.tabs.captureVisibleTab` needs an active tab and the popup owns the lifecycle.

**Files:**
- Create: `extension/src/lib/frames.ts`
- Create: `extension/tests/frames.test.ts`
- Modify: `extension/src/popup/popup.ts` (call `captureFrames` when the page has video and the setting is on)

**Interfaces:**
- Consumes: `getSettings` from `src/lib/storage.ts`.
- Produces: `perceptualHash(pixels: Uint8ClampedArray, w: number, h: number): bigint`, `hammingDistance(a: bigint, b: bigint): number`, `dedupeFrames(frames: {data: string; hash: bigint}[]): string[]`, `captureFrames(tabId: number, opts): Promise<string[]>`.

- [ ] **Step 1: Write the failing test**

Create `extension/tests/frames.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hammingDistance, dedupeFrames, MAX_FRAMES } from "../src/lib/frames";

describe("hammingDistance", () => {
  it("is zero for identical hashes", () => {
    expect(hammingDistance(0b1011n, 0b1011n)).toBe(0);
  });

  it("counts differing bits", () => {
    expect(hammingDistance(0b1011n, 0b1001n)).toBe(1);
    expect(hammingDistance(0b0000n, 0b1111n)).toBe(4);
  });

  it("handles 64-bit hashes", () => {
    expect(hammingDistance(0xffffffffffffffffn, 0x0n)).toBe(64);
  });
});

describe("dedupeFrames", () => {
  it("drops near-identical consecutive frames", () => {
    const frames = [
      { data: "a", hash: 0b0000n },
      { data: "b", hash: 0b0001n }, // 1 bit apart — a near-duplicate
      { data: "c", hash: 0xffffn }, // clearly different
    ];
    expect(dedupeFrames(frames)).toEqual(["a", "c"]);
  });

  it("keeps every frame when all are distinct", () => {
    const frames = [
      { data: "a", hash: 0x0000n },
      { data: "b", hash: 0x0f0fn },
      { data: "c", hash: 0xf0f0n },
    ];
    expect(dedupeFrames(frames)).toEqual(["a", "b", "c"]);
  });

  it("caps at MAX_FRAMES to bound vision cost", () => {
    const frames = Array.from({ length: 40 }, (_, i) => ({
      data: `f${i}`,
      hash: BigInt(i) << 8n,
    }));
    expect(dedupeFrames(frames)).toHaveLength(MAX_FRAMES);
  });

  it("returns an empty array for no input", () => {
    expect(dedupeFrames([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run tests/frames.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/frames'`.

- [ ] **Step 3: Write the implementation**

Create `extension/src/lib/frames.ts`:

```ts
/** Hard cap on frames sent to vision — bounds cost per extraction. */
export const MAX_FRAMES = 24;

/** Below this Hamming distance two frames are the same shot. */
const DUPE_THRESHOLD = 8;

/** Haiku 4.5 caps image input at 1568px on the long edge. */
const MAX_EDGE = 1568;

/** Downscale grid for the perceptual hash — 8x8 gives a 64-bit fingerprint. */
const HASH_EDGE = 8;

export function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b;
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

/** Average-hash: 1 bit per cell, set when the cell is brighter than the mean. */
export function perceptualHash(pixels: Uint8ClampedArray, w: number, h: number): bigint {
  const cellW = w / HASH_EDGE;
  const cellH = h / HASH_EDGE;
  const cells: number[] = [];

  for (let row = 0; row < HASH_EDGE; row++) {
    for (let col = 0; col < HASH_EDGE; col++) {
      let sum = 0;
      let n = 0;
      for (let y = Math.floor(row * cellH); y < Math.floor((row + 1) * cellH); y++) {
        for (let x = Math.floor(col * cellW); x < Math.floor((col + 1) * cellW); x++) {
          const i = (y * w + x) * 4;
          // Rec. 601 luma — cheap and good enough for shot-change detection.
          sum += 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!;
          n++;
        }
      }
      cells.push(n > 0 ? sum / n : 0);
    }
  }

  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  let hash = 0n;
  for (const cell of cells) hash = (hash << 1n) | (cell > mean ? 1n : 0n);
  return hash;
}

export function dedupeFrames(frames: Array<{ data: string; hash: bigint }>): string[] {
  const kept: Array<{ data: string; hash: bigint }> = [];
  for (const frame of frames) {
    const isDupe = kept.some((k) => hammingDistance(k.hash, frame.hash) < DUPE_THRESHOLD);
    if (!isDupe) kept.push(frame);
    if (kept.length >= MAX_FRAMES) break;
  }
  return kept.map((f) => f.data);
}

async function toBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

export interface CaptureOptions {
  /** Milliseconds between screenshots. */
  interval?: number;
  /** How long to sample for. */
  durationMs?: number;
}

/**
 * Screenshot the visible tab on an interval, hash each frame, and return
 * deduped base64 JPEGs sized for the vision cap.
 *
 * Requires `<all_urls>` — request it before calling.
 */
export async function captureFrames(
  tabId: number,
  { interval = 500, durationMs = 8000 }: CaptureOptions = {},
): Promise<string[]> {
  const tab = await chrome.tabs.get(tabId);
  const frames: Array<{ data: string; hash: bigint }> = [];
  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline && frames.length < MAX_FRAMES * 2) {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 80,
    });
    const bitmap = await toBitmap(dataUrl);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const hash = perceptualHash(ctx.getImageData(0, 0, w, h).data, w, h);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const data = btoa(String.fromCharCode(...buffer));

    frames.push({ data, hash });
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return dedupeFrames(frames);
}
```

- [ ] **Step 4: Wire capture into the popup**

In `extension/src/popup/popup.ts`, replace the body of `run()`'s `try` block with:

```ts
    const payload = await askContentScript(tab.id);

    let frames: string[] = [];
    if (payload.hasVideo && settings.captureFrames) {
      const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
      if (granted) {
        card.innerHTML = renderSkeleton();
        frames = await captureFrames(tab.id);
        if (frames.length > 0) {
          payload.via = `${frames.length} video frames` as typeof payload.via;
        }
      }
    }

    const recipe = await extractRecipe(payload, {
      client: createClient(settings.apiKey),
      units: settings.units,
      model: settings.model,
      frames,
    });
```

Add the import at the top: `import { captureFrames } from "../lib/frames";`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd extension && npx vitest run`
Expected: PASS — every suite green, including 8 new frame tests.

- [ ] **Step 6: Verify manually**

Run `npm run build:ext`, reload, open an Instagram Reel or YouTube Short with a recipe, and click the toolbar icon. Grant the `<all_urls>` prompt.
Expected: the badge reads `🎬 N VIDEO FRAMES`, and the extracted recipe reflects on-screen text the caption alone does not carry.

- [ ] **Step 7: Commit**

```bash
git add extension/src/lib/frames.ts extension/tests/frames.test.ts extension/src/popup/popup.ts
git commit -m "feat(mise): video frame capture with perceptual-hash dedupe"
```

---

## Self-Review

**Spec coverage.** `docs/mise-md-format.md`: frontmatter schema → Task 2; `via` vocabulary → Tasks 5 and 11; body structure and mandatory ordering → Task 2; tag taxonomy and sanitization → Task 3; popup rendering rules → Task 7; The Pass → Task 10; unit conversion → Task 6's prompt; ticket counter → Task 4. `CLAUDE.md` constraints: MV3 popup 400px → Task 7; skeleton-first → Tasks 7–8; BYOK → Tasks 4 and 6; keyboard nav and semantic markup → Tasks 7–8; icon ladder → Task 1.

**Deliberately out of scope**, and why:

- **PDF export.** The spec routes it through the Next.js `/api/export/pdf` route, which is a separate surface from the extension. The extension's `.md` path is complete without it.
- **Safari.** `safari-web-extension-converter` wraps a finished Chrome extension; it is a packaging step, not a build task.
- **Servings scaler and the low-confidence / ambiguous-picker states.** Designed in `popup-states.html`, but they are Prep-panel interactions layered on a working extraction path. Adding them before the core loop runs would be building UI against unverified plumbing.
- **The `manual paste` and `image upload` via-methods.** Both are fallback entry points; the primary toolbar-click path covers `schema data`, `article text`, `caption only`, and `N video frames`.

**Type consistency.** `Recipe`, `Frontmatter`, `Ticket`, `Units`, `ViaMethod` are defined once in Task 1 and imported everywhere. `formatTicket` / `formatCaptured` / `serializeRecipe` / `FOOTER` are exported from `markdown.ts` (Task 2) and consumed by Tasks 7, 8, 10. `ExtractionPayload` is defined in `page-source.ts` (Task 5) and consumed by Task 6. `normalizeTags` (Task 3) is called only inside `extractRecipe` (Task 6), so the popup never sees raw model tags.

**Known risk.** `chrome.tabs.captureVisibleTab` screenshots the *visible tab*, not the video element — it captures whatever is on screen, including page chrome. The spec's original design called for cropping to the video's bounding rect. Task 11 ships uncropped frames; if extraction quality suffers on busy pages, the fix is to have the content script report `video.getBoundingClientRect()` and crop in `captureFrames` before hashing.
