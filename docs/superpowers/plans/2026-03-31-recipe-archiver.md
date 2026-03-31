# Recipe Archiver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that extracts recipes from URLs, pasted text, or uploaded photos and exports them as structured markdown files.

**Architecture:** Single Next.js app (App Router) with one API route (`POST /api/extract`) that determines source type, fetches content, sends it to Claude Haiku for structured extraction, and returns recipe JSON. Frontend is a single page with URL input, image upload, recipe preview, download button, and localStorage-backed history.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, Anthropic SDK, Cheerio, @mozilla/readability, youtube-transcript

---

## File Structure

```
recipe-archiver/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, fonts, metadata
│   │   ├── page.tsx                # Main page — input, preview, history
│   │   └── api/
│   │       └── extract/
│   │           └── route.ts        # POST handler — orchestrates extraction
│   ├── lib/
│   │   ├── extractors/
│   │   │   ├── web.ts              # HTML fetching + readability + ld+json
│   │   │   ├── youtube.ts          # YouTube description + transcript
│   │   │   └── instagram.ts       # Instagram oEmbed caption extraction
│   │   ├── llm.ts                  # Claude Haiku API call — text and vision
│   │   ├── markdown.ts             # Recipe JSON → markdown string
│   │   ├── rate-limit.ts           # IP-based rate limiting
│   │   ├── source-detect.ts        # URL → source type classifier
│   │   └── types.ts                # Shared types (Recipe, ExtractionRequest, etc.)
│   ├── components/
│   │   ├── ExtractForm.tsx         # URL input + image upload + text paste
│   │   ├── RecipePreview.tsx       # Rendered markdown preview
│   │   ├── DownloadButton.tsx      # Download .md file
│   │   ├── RecentExtractions.tsx   # localStorage history list
│   │   └── UnitToggle.tsx          # Metric/Imperial toggle
│   └── hooks/
│       ├── useLocalStorage.ts      # Generic localStorage hook with SSR safety
│       └── useExtractionHistory.ts # Recent extractions CRUD (max 20)
├── __tests__/
│   ├── lib/
│   │   ├── source-detect.test.ts
│   │   ├── markdown.test.ts
│   │   ├── llm.test.ts
│   │   ├── rate-limit.test.ts
│   │   └── extractors/
│   │       ├── web.test.ts
│   │       ├── youtube.test.ts
│   │       └── instagram.test.ts
│   └── api/
│       └── extract.test.ts
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                      # ANTHROPIC_API_KEY
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.local`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/benjaminli/Code/recipe-archiver
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Accept overwriting existing files if prompted. This creates the full Next.js scaffold.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/benjaminli/Code/recipe-archiver
npm install @anthropic-ai/sdk cheerio @mozilla/readability youtube-transcript linkedom
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- `linkedom` provides a DOM implementation for Readability (works in Node without jsdom overhead)
- `vitest` for testing

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Set up environment variable**

Create `.env.local`:

```
ANTHROPIC_API_KEY=your-key-here
```

Add `.env.local` to `.gitignore` (should already be there from create-next-app).

- [ ] **Step 5: Create placeholder page**

Replace `src/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">Recipe Archiver</h1>
    </main>
  );
}
```

- [ ] **Step 6: Verify setup**

```bash
cd /Users/benjaminli/Code/recipe-archiver
npm run build
npm run test -- --passWithNoTests
```

Expected: Build succeeds, tests pass (no tests yet).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Shared Types & Source Detection

**Files:**
- Create: `src/lib/types.ts`, `src/lib/source-detect.ts`
- Test: `__tests__/lib/source-detect.test.ts`

- [ ] **Step 1: Define shared types**

Create `src/lib/types.ts`:

```typescript
export interface Recipe {
  title: string;
  source: string;
  servings: string | null;
  prepTime: string | null;
  cookTime: string | null;
  ingredients: string[];
  steps: string[];
  notes: string[];
}

export type SourceType = "youtube" | "instagram" | "web";

export type UnitPreference = "metric" | "imperial";

export interface ExtractionRequest {
  url?: string;
  image?: string; // base64
  text?: string; // manual paste
  units: UnitPreference;
}

export interface ExtractionHistoryEntry {
  title: string;
  source: string;
  date: string; // ISO string
  markdown: string;
}
```

- [ ] **Step 2: Write failing tests for source detection**

Create `__tests__/lib/source-detect.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectSource } from "@/lib/source-detect";

describe("detectSource", () => {
  it("detects youtube.com URLs", () => {
    expect(detectSource("https://www.youtube.com/watch?v=abc123")).toBe("youtube");
  });

  it("detects youtu.be short URLs", () => {
    expect(detectSource("https://youtu.be/abc123")).toBe("youtube");
  });

  it("detects instagram.com URLs", () => {
    expect(detectSource("https://www.instagram.com/p/abc123/")).toBe("instagram");
  });

  it("detects instagram reel URLs", () => {
    expect(detectSource("https://www.instagram.com/reel/abc123/")).toBe("instagram");
  });

  it("returns web for generic URLs", () => {
    expect(detectSource("https://seriouseats.com/best-chili-recipe")).toBe("web");
  });

  it("returns web for unknown domains", () => {
    expect(detectSource("https://example.com/recipe")).toBe("web");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/source-detect.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement source detection**

Create `src/lib/source-detect.ts`:

```typescript
import { SourceType } from "./types";

export function detectSource(url: string): SourceType {
  const hostname = new URL(url).hostname.replace("www.", "");

  if (hostname === "youtube.com" || hostname === "youtu.be") {
    return "youtube";
  }

  if (hostname === "instagram.com") {
    return "instagram";
  }

  return "web";
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/source-detect.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/source-detect.ts __tests__/lib/source-detect.test.ts
git commit -m "feat: add shared types and source detection"
```

---

### Task 3: Markdown Generator

**Files:**
- Create: `src/lib/markdown.ts`
- Test: `__tests__/lib/markdown.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/markdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { recipeToMarkdown } from "@/lib/markdown";
import { Recipe } from "@/lib/types";

const fullRecipe: Recipe = {
  title: "Classic Marinara",
  source: "https://example.com/marinara",
  servings: "4",
  prepTime: "10 minutes",
  cookTime: "30 minutes",
  ingredients: ["400g canned tomatoes", "3 cloves garlic", "Fresh basil"],
  steps: ["Crush garlic and sauté in olive oil.", "Add tomatoes and simmer 25 minutes.", "Stir in basil and season."],
  notes: ["Use San Marzano tomatoes for best results."],
};

describe("recipeToMarkdown", () => {
  it("renders a full recipe with all fields", () => {
    const md = recipeToMarkdown(fullRecipe);
    expect(md).toContain("# Classic Marinara");
    expect(md).toContain("> Source: https://example.com/marinara");
    expect(md).toContain("> Extracted:");
    expect(md).toContain("**Servings:** 4");
    expect(md).toContain("**Prep time:** 10 minutes");
    expect(md).toContain("**Cook time:** 30 minutes");
    expect(md).toContain("- 400g canned tomatoes");
    expect(md).toContain("1. Crush garlic");
    expect(md).toContain("## Notes");
    expect(md).toContain("- Use San Marzano");
  });

  it("omits Details section when all detail fields are null", () => {
    const recipe: Recipe = {
      ...fullRecipe,
      servings: null,
      prepTime: null,
      cookTime: null,
    };
    const md = recipeToMarkdown(recipe);
    expect(md).not.toContain("## Details");
    expect(md).not.toContain("**Servings:**");
  });

  it("omits Notes section when notes array is empty", () => {
    const recipe: Recipe = { ...fullRecipe, notes: [] };
    const md = recipeToMarkdown(recipe);
    expect(md).not.toContain("## Notes");
  });

  it("only includes non-null detail fields", () => {
    const recipe: Recipe = { ...fullRecipe, prepTime: null };
    const md = recipeToMarkdown(recipe);
    expect(md).toContain("**Servings:** 4");
    expect(md).not.toContain("**Prep time:**");
    expect(md).toContain("**Cook time:** 30 minutes");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/markdown.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement markdown generator**

Create `src/lib/markdown.ts`:

```typescript
import { Recipe } from "./types";

export function recipeToMarkdown(recipe: Recipe): string {
  const lines: string[] = [];

  lines.push(`# ${recipe.title}`);
  lines.push("");
  lines.push(`> Source: ${recipe.source}`);
  lines.push(`> Extracted: ${new Date().toISOString().split("T")[0]}`);

  const details: string[] = [];
  if (recipe.servings) details.push(`- **Servings:** ${recipe.servings}`);
  if (recipe.prepTime) details.push(`- **Prep time:** ${recipe.prepTime}`);
  if (recipe.cookTime) details.push(`- **Cook time:** ${recipe.cookTime}`);

  if (details.length > 0) {
    lines.push("");
    lines.push("## Details");
    lines.push(...details);
  }

  lines.push("");
  lines.push("## Ingredients");
  for (const ingredient of recipe.ingredients) {
    lines.push(`- ${ingredient}`);
  }

  lines.push("");
  lines.push("## Steps");
  for (let i = 0; i < recipe.steps.length; i++) {
    lines.push(`${i + 1}. ${recipe.steps[i]}`);
  }

  if (recipe.notes.length > 0) {
    lines.push("");
    lines.push("## Notes");
    for (const note of recipe.notes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/markdown.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.ts __tests__/lib/markdown.test.ts
git commit -m "feat: add recipe-to-markdown generator"
```

---

### Task 4: Rate Limiter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `__tests__/lib/rate-limit.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
  });

  it("allows requests under the limit", () => {
    expect(limiter.check("1.2.3.4")).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check("1.2.3.4")).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check("1.2.3.4")).toEqual({ allowed: true, remaining: 0 });
  });

  it("blocks requests over the limit", () => {
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    const result = limiter.check("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks IPs independently", () => {
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    expect(limiter.check("1.2.3.4").allowed).toBe(false);
    expect(limiter.check("5.6.7.8").allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/rate-limit.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement rate limiter**

Create `src/lib/rate-limit.ts`:

```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private requests: Map<string, number[]> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(ip: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const timestamps = (this.requests.get(ip) ?? []).filter(
      (t) => t > windowStart
    );

    if (timestamps.length >= this.config.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);

    const remaining = this.config.maxRequests - timestamps.length;
    return { allowed: true, remaining };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/rate-limit.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts __tests__/lib/rate-limit.test.ts
git commit -m "feat: add IP-based rate limiter"
```

---

### Task 5: Web Extractor

**Files:**
- Create: `src/lib/extractors/web.ts`
- Test: `__tests__/lib/extractors/web.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/extractors/web.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractFromHtml } from "@/lib/extractors/web";

const htmlWithJsonLd = `
<html>
<head>
<script type="application/ld+json">
{
  "@type": "Recipe",
  "name": "Test Recipe",
  "recipeIngredient": ["1 cup flour", "2 eggs"],
  "recipeInstructions": [
    {"text": "Mix flour and eggs."},
    {"text": "Bake at 350F."}
  ],
  "recipeYield": "4 servings",
  "prepTime": "PT10M",
  "cookTime": "PT30M",
  "description": "A simple test recipe."
}
</script>
</head>
<body><article><p>Some blog content about my life story before the recipe...</p></article></body>
</html>
`;

const htmlWithoutJsonLd = `
<html>
<body>
<article>
  <h1>Grandma's Cookies</h1>
  <p>These are the best cookies you'll ever make. Mix butter, sugar, and flour. Bake for 12 minutes.</p>
</article>
</body>
</html>
`;

describe("extractFromHtml", () => {
  it("extracts structured data from ld+json when present", () => {
    const result = extractFromHtml(htmlWithJsonLd);
    expect(result.jsonLd).toBeDefined();
    expect(result.jsonLd?.name).toBe("Test Recipe");
    expect(result.jsonLd?.recipeIngredient).toContain("1 cup flour");
  });

  it("extracts readable text content", () => {
    const result = extractFromHtml(htmlWithoutJsonLd);
    expect(result.textContent).toContain("Grandma's Cookies");
    expect(result.textContent).toContain("butter");
  });

  it("returns null jsonLd when no recipe schema exists", () => {
    const result = extractFromHtml(htmlWithoutJsonLd);
    expect(result.jsonLd).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/extractors/web.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement web extractor**

Create `src/lib/extractors/web.ts`:

```typescript
import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

interface JsonLdRecipe {
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text: string }>;
  recipeYield?: string;
  prepTime?: string;
  cookTime?: string;
  description?: string;
}

interface WebExtraction {
  jsonLd: JsonLdRecipe | null;
  textContent: string;
}

export function extractFromHtml(html: string): WebExtraction {
  const jsonLd = extractJsonLd(html);
  const textContent = extractReadableText(html);
  return { jsonLd, textContent };
}

function extractJsonLd(html: string): JsonLdRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() ?? "");
      // Handle direct Recipe type
      if (data["@type"] === "Recipe") return data;
      // Handle @graph array
      if (Array.isArray(data["@graph"])) {
        const recipe = data["@graph"].find(
          (item: { "@type"?: string }) => item["@type"] === "Recipe"
        );
        if (recipe) return recipe;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractReadableText(html: string): string {
  const { document } = parseHTML(html);
  const reader = new Readability(document);
  const article = reader.parse();
  return article?.textContent?.trim() ?? "";
}

export async function fetchAndExtract(url: string): Promise<WebExtraction> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RecipeArchiver/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  return extractFromHtml(html);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/extractors/web.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extractors/web.ts __tests__/lib/extractors/web.test.ts
git commit -m "feat: add web page extractor with ld+json and readability"
```

---

### Task 6: YouTube Extractor

**Files:**
- Create: `src/lib/extractors/youtube.ts`
- Test: `__tests__/lib/extractors/youtube.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/extractors/youtube.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractVideoId } from "@/lib/extractors/youtube";

describe("extractVideoId", () => {
  it("extracts ID from standard youtube.com URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts ID from youtu.be short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts ID with extra query params", () => {
    expect(
      extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractVideoId("https://example.com/video")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/extractors/youtube.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement YouTube extractor**

Create `src/lib/extractors/youtube.ts`:

```typescript
import { YoutubeTranscript } from "youtube-transcript";

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace("www.", "");

    if (hostname === "youtube.com") {
      return parsed.searchParams.get("v");
    }

    if (hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchYoutubeContent(
  url: string
): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const parts: string[] = [];

  // Fetch transcript
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const transcriptText = transcript.map((t) => t.text).join(" ");
    if (transcriptText) {
      parts.push("--- VIDEO TRANSCRIPT ---");
      parts.push(transcriptText);
    }
  } catch {
    // Transcript may not be available — that's OK
  }

  // Fetch page HTML for description (from oEmbed + page scrape)
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RecipeArchiver/1.0)",
        },
      }
    );
    const html = await response.text();

    // Extract description from meta tag
    const descMatch = html.match(
      /<meta\s+name="description"\s+content="([^"]*)"/ 
    );
    if (descMatch?.[1]) {
      parts.unshift("--- VIDEO DESCRIPTION ---");
      parts.splice(1, 0, descMatch[1]);
    }
  } catch {
    // Page scrape failed — continue with transcript only
  }

  if (parts.length === 0) {
    throw new Error(
      "Could not extract any content from this YouTube video"
    );
  }

  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/extractors/youtube.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extractors/youtube.ts __tests__/lib/extractors/youtube.test.ts
git commit -m "feat: add YouTube extractor with transcript and description"
```

---

### Task 7: Instagram Extractor

**Files:**
- Create: `src/lib/extractors/instagram.ts`
- Test: `__tests__/lib/extractors/instagram.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/extractors/instagram.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildOEmbedUrl, parseOEmbedCaption } from "@/lib/extractors/instagram";

describe("buildOEmbedUrl", () => {
  it("builds correct oEmbed URL for a post", () => {
    const url = buildOEmbedUrl("https://www.instagram.com/p/abc123/");
    expect(url).toBe(
      "https://graph.facebook.com/v18.0/instagram_oembed?url=https%3A%2F%2Fwww.instagram.com%2Fp%2Fabc123%2F&access_token=&maxwidth=658"
    );
  });
});

describe("parseOEmbedCaption", () => {
  it("extracts title (caption) from oEmbed response", () => {
    const response = {
      title: "The best pasta recipe! Ingredients: 200g pasta, 100g cheese...",
      author_name: "chefname",
      html: "<blockquote>...</blockquote>",
    };
    expect(parseOEmbedCaption(response)).toBe(
      "The best pasta recipe! Ingredients: 200g pasta, 100g cheese..."
    );
  });

  it("returns null when title is missing", () => {
    expect(parseOEmbedCaption({})).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/extractors/instagram.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement Instagram extractor**

Create `src/lib/extractors/instagram.ts`:

```typescript
interface OEmbedResponse {
  title?: string;
  author_name?: string;
  html?: string;
  [key: string]: unknown;
}

export function buildOEmbedUrl(postUrl: string): string {
  const encoded = encodeURIComponent(postUrl);
  // access_token is required but can be empty for basic public posts
  return `https://graph.facebook.com/v18.0/instagram_oembed?url=${encoded}&access_token=&maxwidth=658`;
}

export function parseOEmbedCaption(response: OEmbedResponse): string | null {
  return response.title ?? null;
}

export async function fetchInstagramContent(url: string): Promise<{
  caption: string | null;
  needsManualPaste: boolean;
}> {
  try {
    const oembedUrl = buildOEmbedUrl(url);
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return { caption: null, needsManualPaste: true };
    }

    const data: OEmbedResponse = await response.json();
    const caption = parseOEmbedCaption(data);

    if (!caption) {
      return { caption: null, needsManualPaste: true };
    }

    return { caption, needsManualPaste: false };
  } catch {
    return { caption: null, needsManualPaste: true };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/extractors/instagram.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extractors/instagram.ts __tests__/lib/extractors/instagram.test.ts
git commit -m "feat: add Instagram oEmbed extractor with manual paste fallback"
```

---

### Task 8: LLM Integration

**Files:**
- Create: `src/lib/llm.ts`
- Test: `__tests__/lib/llm.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/llm.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/llm";

describe("buildSystemPrompt", () => {
  it("includes metric instruction when units is metric", () => {
    const prompt = buildSystemPrompt("metric");
    expect(prompt).toContain("metric");
    expect(prompt).toContain("JSON");
  });

  it("includes imperial instruction when units is imperial", () => {
    const prompt = buildSystemPrompt("imperial");
    expect(prompt).toContain("imperial");
  });
});

describe("buildUserPrompt", () => {
  it("wraps text content with extraction instruction", () => {
    const prompt = buildUserPrompt("Here is a recipe for pasta with garlic and oil.");
    expect(prompt).toContain("Here is a recipe for pasta");
    expect(prompt).toContain("Extract the recipe");
  });

  it("truncates content over 50000 characters", () => {
    const longText = "a".repeat(60_000);
    const prompt = buildUserPrompt(longText);
    // The text portion should be capped
    expect(prompt.length).toBeLessThan(55_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/lib/llm.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement LLM module**

Create `src/lib/llm.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { Recipe, UnitPreference } from "./types";

const MAX_TEXT_LENGTH = 50_000;

const client = new Anthropic();

export function buildSystemPrompt(units: UnitPreference): string {
  return `You are a recipe extraction assistant. Extract the recipe from the provided content and return it as JSON.

All measurements must be in ${units} units. Convert if necessary.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "title": "string",
  "servings": "string or null",
  "prepTime": "string or null",
  "cookTime": "string or null",
  "ingredients": ["string"],
  "steps": ["string"],
  "notes": ["string"]
}

Rules:
- If a field cannot be determined, set it to null (or empty array for ingredients/steps/notes)
- Steps should be clear, concise imperative sentences
- Ingredients should include quantities and units
- Notes should capture any useful tips, substitutions, or storage instructions
- Do not invent information not present in the source`;
}

export function buildUserPrompt(text: string): string {
  const truncated =
    text.length > MAX_TEXT_LENGTH
      ? text.slice(0, MAX_TEXT_LENGTH)
      : text;
  return `Extract the recipe from the following content:\n\n${truncated}`;
}

export async function parseRecipeFromText(
  text: string,
  units: UnitPreference
): Promise<Recipe> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: buildSystemPrompt(units),
    messages: [{ role: "user", content: buildUserPrompt(text) }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return JSON.parse(content.text) as Recipe;
}

export async function parseRecipeFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  units: UnitPreference
): Promise<Recipe> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: buildSystemPrompt(units),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "Extract the recipe from this image.",
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return JSON.parse(content.text) as Recipe;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/lib/llm.test.ts
```

Expected: All 4 tests PASS (only testing prompt builders, not API calls).

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm.ts __tests__/lib/llm.test.ts
git commit -m "feat: add Claude Haiku LLM integration for recipe parsing"
```

---

### Task 9: API Route

**Files:**
- Create: `src/app/api/extract/route.ts`
- Test: `__tests__/api/extract.test.ts`

- [ ] **Step 1: Write failing test for request validation**

Create `__tests__/api/extract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateRequest } from "@/app/api/extract/route";

describe("validateRequest", () => {
  it("accepts a valid URL request", () => {
    const result = validateRequest({
      url: "https://example.com/recipe",
      units: "metric",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a valid image request", () => {
    const result = validateRequest({
      image: "data:image/jpeg;base64,abc123",
      units: "metric",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a valid text request", () => {
    const result = validateRequest({
      text: "Here is my recipe...",
      units: "imperial",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects request with no input", () => {
    const result = validateRequest({ units: "metric" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("url, image, or text");
  });

  it("rejects invalid units", () => {
    const result = validateRequest({
      url: "https://example.com",
      units: "cubits",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("units");
  });

  it("rejects oversized image", () => {
    const bigImage = "data:image/jpeg;base64," + "a".repeat(7_000_000);
    const result = validateRequest({ image: bigImage, units: "metric" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("5MB");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- __tests__/api/extract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the API route**

Create `src/app/api/extract/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { detectSource } from "@/lib/source-detect";
import { fetchAndExtract } from "@/lib/extractors/web";
import { fetchYoutubeContent } from "@/lib/extractors/youtube";
import { fetchInstagramContent } from "@/lib/extractors/instagram";
import { parseRecipeFromText, parseRecipeFromImage } from "@/lib/llm";
import { recipeToMarkdown } from "@/lib/markdown";
import { RateLimiter } from "@/lib/rate-limit";
import { UnitPreference } from "@/lib/types";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
});

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRequest(body: Record<string, unknown>): ValidationResult {
  const { url, image, text, units } = body;

  if (!url && !image && !text) {
    return { valid: false, error: "Must provide url, image, or text" };
  }

  if (units !== "metric" && units !== "imperial") {
    return { valid: false, error: "units must be 'metric' or 'imperial'" };
  }

  if (typeof image === "string" && image.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image must be under 5MB" };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const rateCheck = rateLimiter.check(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const validation = validateRequest(body);

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const units: UnitPreference = body.units;

  try {
    // Image path
    if (body.image) {
      const base64Match = (body.image as string).match(
        /^data:(image\/\w+);base64,(.+)$/
      );
      if (!base64Match) {
        return NextResponse.json(
          { error: "Invalid image format. Expected base64 data URI." },
          { status: 400 }
        );
      }

      const mediaType = base64Match[1] as
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "image/gif";
      const imageData = base64Match[2];

      const recipe = await parseRecipeFromImage(imageData, mediaType, units);
      recipe.source = "Photo upload";
      const markdown = recipeToMarkdown(recipe);
      return NextResponse.json({ recipe, markdown });
    }

    // Text paste path
    if (body.text) {
      const recipe = await parseRecipeFromText(body.text as string, units);
      recipe.source = "Manual paste";
      const markdown = recipeToMarkdown(recipe);
      return NextResponse.json({ recipe, markdown });
    }

    // URL path
    const url = body.url as string;
    const sourceType = detectSource(url);
    let rawText = "";

    switch (sourceType) {
      case "youtube": {
        rawText = await fetchYoutubeContent(url);
        break;
      }
      case "instagram": {
        const { caption, needsManualPaste } =
          await fetchInstagramContent(url);
        if (needsManualPaste) {
          return NextResponse.json(
            {
              error: "instagram_paste_needed",
              message:
                "Could not extract from this Instagram post. Please paste the caption text manually.",
            },
            { status: 422 }
          );
        }
        rawText = caption!;
        break;
      }
      case "web": {
        const extraction = await fetchAndExtract(url);
        // Prefer ld+json structured data
        if (extraction.jsonLd) {
          rawText =
            "--- STRUCTURED RECIPE DATA ---\n" +
            JSON.stringify(extraction.jsonLd) +
            "\n\n--- PAGE CONTENT ---\n" +
            extraction.textContent;
        } else {
          rawText = extraction.textContent;
        }
        break;
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract any content from this URL." },
        { status: 422 }
      );
    }

    const recipe = await parseRecipeFromText(rawText, units);
    recipe.source = url;
    const markdown = recipeToMarkdown(recipe);

    return NextResponse.json({ recipe, markdown });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- __tests__/api/extract.test.ts
```

Expected: All 6 validation tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/extract/route.ts __tests__/api/extract.test.ts
git commit -m "feat: add /api/extract route with validation and rate limiting"
```

---

### Task 10: localStorage Hooks

**Files:**
- Create: `src/hooks/useLocalStorage.ts`, `src/hooks/useExtractionHistory.ts`

- [ ] **Step 1: Implement useLocalStorage hook**

Create `src/hooks/useLocalStorage.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch {
      // localStorage not available or parse error
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue =
          value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // localStorage full or unavailable
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
```

- [ ] **Step 2: Implement useExtractionHistory hook**

Create `src/hooks/useExtractionHistory.ts`:

```typescript
"use client";

import { useLocalStorage } from "./useLocalStorage";
import { ExtractionHistoryEntry } from "@/lib/types";

const MAX_HISTORY = 20;

export function useExtractionHistory() {
  const [history, setHistory] = useLocalStorage<ExtractionHistoryEntry[]>(
    "recentExtractions",
    []
  );

  const addEntry = (entry: ExtractionHistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return { history, addEntry, clearHistory };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLocalStorage.ts src/hooks/useExtractionHistory.ts
git commit -m "feat: add localStorage hooks for unit preference and extraction history"
```

---

### Task 11: Frontend Components

**Files:**
- Create: `src/components/ExtractForm.tsx`, `src/components/RecipePreview.tsx`, `src/components/DownloadButton.tsx`, `src/components/RecentExtractions.tsx`, `src/components/UnitToggle.tsx`

This task builds all UI components and wires them into the page. Creative direction ("The Bear" aesthetic) will be applied in Task 12 using the design-for-ai skill.

- [ ] **Step 1: Create UnitToggle component**

Create `src/components/UnitToggle.tsx`:

```tsx
"use client";

import { UnitPreference } from "@/lib/types";

interface UnitToggleProps {
  value: UnitPreference;
  onChange: (unit: UnitPreference) => void;
}

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange("metric")}
        className={`px-3 py-1 text-sm rounded ${
          value === "metric"
            ? "bg-white text-black font-bold"
            : "bg-transparent text-gray-400"
        }`}
      >
        Metric
      </button>
      <button
        onClick={() => onChange("imperial")}
        className={`px-3 py-1 text-sm rounded ${
          value === "imperial"
            ? "bg-white text-black font-bold"
            : "bg-transparent text-gray-400"
        }`}
      >
        Imperial
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create ExtractForm component**

Create `src/components/ExtractForm.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { UnitPreference } from "@/lib/types";

interface ExtractFormProps {
  units: UnitPreference;
  onExtract: (result: { recipe: Record<string, unknown>; markdown: string }) => void;
  onError: (error: string) => void;
  onInstagramPaste: () => void;
}

export function ExtractForm({
  units,
  onExtract,
  onError,
  onInstagramPaste,
}: ExtractFormProps) {
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), units }),
      });
      const data = await res.json();

      if (data.error === "instagram_paste_needed") {
        setShowPaste(true);
        onInstagramPaste();
        return;
      }

      if (!res.ok) throw new Error(data.error);
      onExtract(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPaste = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText.trim(), units }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onExtract(data);
      setShowPaste(false);
      setPasteText("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError("Image must be under 5MB");
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, units }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onExtract(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* URL Input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a recipe URL..."
          className="flex-1 px-4 py-3 bg-transparent border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white"
          onKeyDown={(e) => e.key === "Enter" && handleSubmitUrl()}
          disabled={loading}
        />
        <button
          onClick={handleSubmitUrl}
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Extract"}
        </button>
      </div>

      {/* Image Upload */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 text-sm border border-gray-600 rounded text-gray-300 hover:text-white hover:border-white disabled:opacity-50"
        >
          Upload photo
        </button>
        <span className="text-xs text-gray-500">
          JPG, PNG, or HEIC — max 5MB
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Manual Paste (shown for Instagram fallback or user choice) */}
      {showPaste && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            Paste the recipe text or Instagram caption below:
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-transparent border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white resize-y"
            placeholder="Paste recipe text here..."
          />
          <button
            onClick={handleSubmitPaste}
            disabled={loading || !pasteText.trim()}
            className="px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "..." : "Extract from text"}
          </button>
        </div>
      )}

      {/* Toggle manual paste mode */}
      {!showPaste && (
        <button
          onClick={() => setShowPaste(true)}
          className="text-sm text-gray-500 hover:text-gray-300 underline"
        >
          Or paste text manually
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create RecipePreview component**

Create `src/components/RecipePreview.tsx`:

```tsx
"use client";

interface RecipePreviewProps {
  markdown: string;
}

export function RecipePreview({ markdown }: RecipePreviewProps) {
  // Render markdown as pre-formatted text for now.
  // The design pass (Task 12) will refine this into styled HTML.
  return (
    <div className="w-full border border-gray-700 rounded p-6 bg-gray-900/50">
      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200 leading-relaxed">
        {markdown}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Create DownloadButton component**

Create `src/components/DownloadButton.tsx`:

```tsx
"use client";

interface DownloadButtonProps {
  markdown: string;
  title: string;
}

export function DownloadButton({ markdown, title }: DownloadButtonProps) {
  const handleDownload = () => {
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200"
    >
      Download .md
    </button>
  );
}
```

- [ ] **Step 5: Create RecentExtractions component**

Create `src/components/RecentExtractions.tsx`:

```tsx
"use client";

import { ExtractionHistoryEntry } from "@/lib/types";

interface RecentExtractionsProps {
  history: ExtractionHistoryEntry[];
  onSelect: (entry: ExtractionHistoryEntry) => void;
  onClear: () => void;
}

export function RecentExtractions({
  history,
  onSelect,
  onClear,
}: RecentExtractionsProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide">
          Recent
        </h2>
        <button
          onClick={onClear}
          className="text-xs text-gray-600 hover:text-gray-400"
        >
          Clear
        </button>
      </div>
      <ul className="space-y-1">
        {history.map((entry, i) => (
          <li key={`${entry.date}-${i}`}>
            <button
              onClick={() => onSelect(entry)}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-800/50 text-sm"
            >
              <span className="text-gray-200">{entry.title}</span>
              <span className="text-gray-600 ml-2 text-xs">
                {new Date(entry.date).toLocaleDateString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add UI components — form, preview, download, history, unit toggle"
```

---

### Task 12: Wire Up the Main Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Build the main page**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ExtractForm } from "@/components/ExtractForm";
import { RecipePreview } from "@/components/RecipePreview";
import { DownloadButton } from "@/components/DownloadButton";
import { RecentExtractions } from "@/components/RecentExtractions";
import { UnitToggle } from "@/components/UnitToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useExtractionHistory } from "@/hooks/useExtractionHistory";
import { UnitPreference, ExtractionHistoryEntry } from "@/lib/types";

export default function Home() {
  const [units, setUnits] = useLocalStorage<UnitPreference>(
    "unitPreference",
    "metric"
  );
  const { history, addEntry, clearHistory } = useExtractionHistory();
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleExtract = (result: {
    recipe: Record<string, unknown>;
    markdown: string;
  }) => {
    setCurrentMarkdown(result.markdown);
    setCurrentTitle(result.recipe.title as string);
    setError(null);

    addEntry({
      title: result.recipe.title as string,
      source: result.recipe.source as string,
      date: new Date().toISOString(),
      markdown: result.markdown,
    });
  };

  const handleSelectHistory = (entry: ExtractionHistoryEntry) => {
    setCurrentMarkdown(entry.markdown);
    setCurrentTitle(entry.title);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Recipe Archiver
          </h1>
          <UnitToggle value={units} onChange={setUnits} />
        </div>

        {/* Extract Form */}
        <ExtractForm
          units={units}
          onExtract={handleExtract}
          onError={(msg) => {
            setError(msg);
            setCurrentMarkdown(null);
          }}
          onInstagramPaste={() => setError(null)}
        />

        {/* Error */}
        {error && (
          <div className="px-4 py-3 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Preview + Download */}
        {currentMarkdown && (
          <div className="space-y-4">
            <RecipePreview markdown={currentMarkdown} />
            <DownloadButton markdown={currentMarkdown} title={currentTitle} />
          </div>
        )}

        {/* History */}
        <RecentExtractions
          history={history}
          onSelect={handleSelectHistory}
          onClear={clearHistory}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update layout with metadata**

Update `src/app/layout.tsx` to set metadata:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe Archiver",
  description: "Extract recipes from any source. Download as markdown.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/benjaminli/Code/recipe-archiver
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: wire up main page with all components"
```

---

### Task 13: Design Pass — "The Bear" Aesthetic

**Files:**
- Modify: `src/app/layout.tsx` (fonts)
- Modify: `src/app/page.tsx` (layout refinement)
- Modify: all components in `src/components/` (styling)
- Modify: `tailwind.config.ts` (custom theme tokens)
- Possibly modify: `src/app/globals.css`

This task applies the "The Bear" creative direction using the `/design` skill from design-for-ai. The skill will guide:

- [ ] **Step 1: Invoke `/design` skill** with the creative brief from the spec (industrial warmth, typography as texture, restraint with edge, functional not decorative, "The Bear" mood)

- [ ] **Step 2: Invoke `/fonts` skill** to select a gritty display font + clean mono/sans body font that evoke a kitchen ticket printer aesthetic

- [ ] **Step 3: Invoke `/color` skill** to build a warm, dark palette with flame orange or copper accent

- [ ] **Step 4: Apply design tokens** to `tailwind.config.ts` — colors, fonts, spacing scale

- [ ] **Step 5: Restyle all components** according to the design output — update each component file with the new typography, colors, and spacing

- [ ] **Step 6: Take screenshots and verify** the design feels cohesive on desktop and mobile viewports

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: apply 'The Bear' visual design — fonts, colors, layout"
```

---

### Task 14: End-to-End Smoke Test

**Files:** None — manual verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/benjaminli/Code/recipe-archiver
npm run dev
```

- [ ] **Step 2: Test web URL extraction**

Open `http://localhost:3000` in a browser. Paste a recipe URL from a popular food blog (e.g., a Serious Eats or NYT Cooking recipe). Verify:
- Recipe is extracted and displayed in the preview
- All fields (title, servings, prep/cook time, ingredients, steps) are present
- Download produces a valid `.md` file
- Entry appears in recent history

- [ ] **Step 3: Test YouTube extraction**

Paste a YouTube cooking video URL. Verify recipe is extracted from transcript/description.

- [ ] **Step 4: Test image upload**

Upload a photo of a cookbook page. Verify the recipe is extracted via vision.

- [ ] **Step 5: Test unit toggle**

Switch to imperial, extract a metric recipe. Verify measurements are converted.

- [ ] **Step 6: Test recent history**

Verify history shows previous extractions. Click one to re-open. Clear history works.

- [ ] **Step 7: Test mobile**

Open on a phone (or use device emulation). Verify the layout is usable, image upload triggers camera.

- [ ] **Step 8: Test rate limiting**

Send 11 rapid requests. Verify the 11th returns a 429 error.

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
