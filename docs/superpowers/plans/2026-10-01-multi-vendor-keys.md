# Multi-vendor API keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Mise user bring a key from Anthropic, OpenAI, Gemini, Grok, Mistral, OpenRouter or any OpenAI-compatible server, and fire a recipe with it.

**Architecture:** The vendor-independent extraction core (`lib/extract.ts`) dispatches to one of two adapters: the existing Anthropic SDK call, or a plain-`fetch` Chat Completions call. A presets table carries each vendor's quirks; `resolveConnection` turns settings into what an adapter needs; both adapters throw one `ProviderError` that the error card maps to vendor-named copy.

**Tech Stack:** TypeScript, esbuild, vitest (node + happy-dom), `@anthropic-ai/sdk`, Chrome MV3.

**Spec:** `docs/superpowers/specs/2026-10-01-multi-vendor-keys-design.md`

All paths below are relative to the worktree root
`/Users/benjaminli/Code/recipe-archiver/.claude/worktrees/multi-vendor-keys`.
Run every command from there.

## Global Constraints

- No new dependencies. `package.json` and `package-lock.json` do not change.
- `manifest.json` does not change.
- Never hand-edit `extension/src/popup/popup.css` or `glyphs.ts`; change `extension/scripts/port-design.mjs` or the specimen, then `npm run port:design`.
- `extension/src/embed/` must not import anything under `lib/providers/`.
- Model IDs, base URLs and quirks exactly as the spec's Presets table.
- Error labels exactly as the spec's Copy table; bodies name the vendor.
- Commit messages: imperative subject, body if useful, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After every task: `npm run test:ext` green and `npx tsc --noEmit -p extension/tsconfig.json` clean. Baseline before Task 1: 234 tests, tsc clean, `npm run audit:ext` output saved to `.scratch/audit-before.txt`.

## Review Focus

1. **A user who picked Custom pastes an `sk-` key** (DeepSeek, Moonshot): the menu must stay on Custom. Pinned in Task 7.
2. **A stored pre-migration setting** (`model: "claude-opus-5"`) must come back as Anthropic + Thorough, and the first Save must write no `model` key. Pinned in Task 4.
3. **A bad key on Gemini or xAI arrives as HTTP 400**, and must read KEY REJECTED, while OpenAI's strict-schema 400 must read REQUEST REJECTED. Pinned in Task 2.
4. **A Mistral user on a 24-frame Reel**: 8 frames sent, and the `.md` says 8. Pinned in Tasks 3 and 5.
5. **A stalled local server**: the card must give up with TIMED OUT, not spin forever. Pinned in Task 5 (adapter) and Task 6 (copy).

---

### Task 1: Presets, detection, base-URL normalisation

**Files:**
- Create: `extension/src/lib/providers/presets.ts`
- Test: `extension/tests/presets.test.ts`

**Interfaces:**
- Produces: `ProviderId`, `PresetId`, `Tier`, `Protocol`, `Preset`, `PRESETS: Record<PresetId, Preset>`, `PROVIDER_IDS: readonly ProviderId[]`, `PROVIDER_LABELS: Record<ProviderId, string>`, `CUSTOM_DEFAULTS`, `detectProvider(key: string): PresetId | null`, `normalizeBaseURL(url: string): string`.

- [ ] **Step 1: Write the failing test** — `extension/tests/presets.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  detectProvider,
  normalizeBaseURL,
  PRESETS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
} from "../src/lib/providers/presets";

describe("detectProvider", () => {
  it.each([
    ["sk-ant-api03-abc", "anthropic"],
    ["sk-or-v1-abc", "openrouter"],
    ["xai-abc", "xai"],
    ["AIzaSyAbc", "gemini"],
    ["AQ.Ab8abc", "gemini"],
    ["sk-proj-abc", "openai"],
    ["sk-abc", "openai"],
    ["  sk-ant-api03-abc  ", "anthropic"],
  ])("reads %s as %s", (key, expected) => {
    expect(detectProvider(key)).toBe(expected);
  });

  // Order matters: both of these also start with "sk-".
  it("tests the longer sk- prefixes before bare sk-", () => {
    expect(detectProvider("sk-ant-x")).toBe("anthropic");
    expect(detectProvider("sk-or-x")).toBe("openrouter");
  });

  it("returns null for a key with no known prefix (Mistral issues these)", () => {
    expect(detectProvider("a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6")).toBeNull();
  });

  it("returns null for an empty key", () => {
    expect(detectProvider("")).toBeNull();
    expect(detectProvider("   ")).toBeNull();
  });
});

describe("normalizeBaseURL", () => {
  it.each([
    ["https://api.deepseek.com/v1/", "https://api.deepseek.com/v1"],
    ["https://api.deepseek.com/v1/chat/completions", "https://api.deepseek.com/v1"],
    ["  http://localhost:11434/v1/chat/completions/  ", "http://localhost:11434/v1"],
    ["https://x.test/v1", "https://x.test/v1"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeBaseURL(input)).toBe(expected);
  });
});

describe("PRESETS", () => {
  it("covers every provider except custom, in menu order", () => {
    expect(PROVIDER_IDS).toEqual([
      "anthropic", "openai", "gemini", "xai", "mistral", "openrouter", "custom",
    ]);
    for (const id of PROVIDER_IDS) expect(PROVIDER_LABELS[id]).toBeTruthy();
  });

  it("caps Mistral at 8 images, its documented limit", () => {
    expect(PRESETS.mistral.maxImages).toBe(8);
  });

  it("uses max_completion_tokens where max_tokens is deprecated", () => {
    expect(PRESETS.openai.tokenParam).toBe("max_completion_tokens");
    expect(PRESETS.xai.tokenParam).toBe("max_completion_tokens");
    expect(PRESETS.mistral.tokenParam).toBe("max_tokens");
  });

  it("only Anthropic uses the native protocol", () => {
    for (const p of Object.values(PRESETS)) {
      expect(p.protocol).toBe(p.id === "anthropic" ? "anthropic" : "openai");
    }
  });

  it("asks OpenRouter to route only to backends that honour the schema", () => {
    expect(PRESETS.openrouter.extraBody).toEqual({ provider: { require_parameters: true } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root extension tests/presets.test.ts`
Expected: FAIL, cannot resolve `../src/lib/providers/presets`.

- [ ] **Step 3: Implement** — `extension/src/lib/providers/presets.ts`

```ts
import { MAX_FRAMES } from "../frames";

/**
 * Every vendor Mise can talk to, and what each one needs.
 *
 * Model IDs and request quirks were read from each vendor's own docs on
 * 2026-10-01 (MemPalace drawer drawer_code_recipe_archiver_a364eba8a02a61f0b89b703b).
 * They drift. The live test per vendor (tests/live/providers.live.ts) is what
 * notices; change them here and nowhere else.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "xai"
  | "mistral"
  | "openrouter"
  | "custom";
export type PresetId = Exclude<ProviderId, "custom">;
export type Tier = "fast" | "thorough";
export type Protocol = "anthropic" | "openai";

export interface Preset {
  id: PresetId;
  /** Vendor name in Prep and in error copy. */
  label: string;
  /** Where the key goes — named in the Prep hint and the network error. */
  host: string;
  /** Where to make a key. */
  keyUrl: string;
  protocol: Protocol;
  /** Chat Completions base; the adapter appends /chat/completions. Unused for Anthropic. */
  baseURL: string;
  models: Record<Tier, string>;
  /** Most images one request may carry. Frames are sampled down to this. */
  maxImages: number;
  /** OpenAI and xAI deprecated max_tokens; Mistral only knows max_tokens. */
  tokenParam: "max_tokens" | "max_completion_tokens";
  /** Send json_schema.strict = true. Only where the vendor documents it. */
  strict: boolean;
  /** Merged into the request body last. */
  extraBody: Record<string, unknown>;
}

export const PRESETS: Record<PresetId, Preset> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    host: "api.anthropic.com",
    keyUrl: "https://console.anthropic.com/settings/keys",
    protocol: "anthropic",
    baseURL: "https://api.anthropic.com",
    models: { fast: "claude-haiku-4-5", thorough: "claude-opus-5-5" },
    maxImages: MAX_FRAMES,
    tokenParam: "max_tokens",
    strict: false,
    extraBody: {},
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    host: "api.openai.com",
    keyUrl: "https://platform.openai.com/api-keys",
    protocol: "openai",
    baseURL: "https://api.openai.com/v1",
    models: { fast: "gpt-6-luna", thorough: "gpt-6.1-sol" },
    maxImages: MAX_FRAMES,
    tokenParam: "max_completion_tokens",
    strict: true,
    // Reasoning is on by default and the card waits on it; extraction gains nothing.
    extraBody: { reasoning_effort: "low" },
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    host: "generativelanguage.googleapis.com",
    keyUrl: "https://aistudio.google.com/app/apikey",
    protocol: "openai",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: { fast: "gemini-3.5-flash-lite", thorough: "gemini-3.8-flash" },
    maxImages: MAX_FRAMES,
    tokenParam: "max_tokens",
    strict: false,
    // "low", not "minimal": Gemini 3.8 Flash rejects "minimal".
    extraBody: { reasoning_effort: "low" },
  },
  xai: {
    id: "xai",
    label: "Grok",
    host: "api.x.ai",
    keyUrl: "https://console.x.ai",
    protocol: "openai",
    baseURL: "https://api.x.ai/v1",
    models: { fast: "grok-4.3", thorough: "grok-4.7" },
    maxImages: MAX_FRAMES,
    tokenParam: "max_completion_tokens",
    strict: false,
    extraBody: {},
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    host: "api.mistral.ai",
    keyUrl: "https://console.mistral.ai/api-keys",
    protocol: "openai",
    baseURL: "https://api.mistral.ai/v1",
    models: { fast: "mistral-small-latest", thorough: "mistral-medium-latest" },
    maxImages: 8,
    tokenParam: "max_tokens",
    strict: false,
    extraBody: {},
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    host: "openrouter.ai",
    keyUrl: "https://openrouter.ai/settings/keys",
    protocol: "openai",
    baseURL: "https://openrouter.ai/api/v1",
    models: { fast: "google/gemini-3.5-flash-lite", thorough: "anthropic/claude-opus-5.5" },
    maxImages: MAX_FRAMES,
    tokenParam: "max_tokens",
    strict: true,
    // Without this OpenRouter may route to a backend that ignores the schema.
    extraBody: { provider: { require_parameters: true } },
  },
};

/** Menu order in Prep. */
export const PROVIDER_IDS: readonly ProviderId[] = [
  "anthropic",
  "openai",
  "gemini",
  "xai",
  "mistral",
  "openrouter",
  "custom",
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: PRESETS.anthropic.label,
  openai: PRESETS.openai.label,
  gemini: PRESETS.gemini.label,
  xai: PRESETS.xai.label,
  mistral: PRESETS.mistral.label,
  openrouter: PRESETS.openrouter.label,
  custom: "Custom (OpenAI-compatible)",
};

/** What a Custom endpoint gets, since we cannot know its quirks. */
export const CUSTOM_DEFAULTS = {
  protocol: "openai" as Protocol,
  maxImages: MAX_FRAMES,
  tokenParam: "max_tokens" as const,
  strict: false,
};

/**
 * Ordered, first match wins. The longer sk- prefixes must come before bare
 * "sk-", which OpenAI and several of its imitators use. Mistral keys carry no
 * prefix, so they come back null by design and the user picks from the menu.
 */
const DETECTION: ReadonlyArray<readonly [string, PresetId]> = [
  ["sk-ant-", "anthropic"],
  ["sk-or-", "openrouter"],
  ["xai-", "xai"],
  ["AIza", "gemini"],
  ["AQ.", "gemini"],
  ["sk-", "openai"],
];

export function detectProvider(key: string): PresetId | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  for (const [prefix, id] of DETECTION) {
    if (trimmed.startsWith(prefix)) return id;
  }
  return null;
}

/**
 * Users paste whatever their provider's docs show, which is often the full
 * endpoint. Keep the base: no trailing slash, no /chat/completions.
 */
export function normalizeBaseURL(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/+$/, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --root extension tests/presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/providers/presets.ts extension/tests/presets.test.ts
git commit -m "Add provider presets, key detection and base-URL normalisation"
```

---

### Task 2: ProviderError and response classification

**Files:**
- Create: `extension/src/lib/providers/errors.ts`
- Test: `extension/tests/provider-errors.test.ts`

**Interfaces:**
- Produces: `ProviderErrorKind`, `ErrorContext { label; host; model; custom: boolean; url }`, `class ProviderError extends Error { kind; status: number | null; detail: string; label; host; model; custom; url }` with constructor `(kind, ctx: ErrorContext, extra?: { status?: number | null; detail?: string })`, `readErrorBody(body: unknown): { message: string; code: string | number | null }`, `classifyResponse(status: number, body: unknown): { kind: ProviderErrorKind; detail: string }`.

- [ ] **Step 1: Write the failing test** — `extension/tests/provider-errors.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  classifyResponse,
  ProviderError,
  readErrorBody,
  type ErrorContext,
} from "../src/lib/providers/errors";

// Bodies as the vendors actually return them (research probes, 2026-10-01).
const OPENAI_401 = { error: { message: "Incorrect API key provided: sk-x.", type: "invalid_request_error", param: null, code: "invalid_api_key" } };
const GEMINI_400 = [{ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }];
const XAI_400 = { code: "invalid-argument", error: "Incorrect API key provided: xa***. You can obtain an API key from https://console.x.ai." };
const MISTRAL_401 = { detail: "Invalid API Key" };
const OPENROUTER_402 = { error: { code: 402, message: "Insufficient credits." } };
const ANTHROPIC_LOW_BALANCE = { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits." } };
const GEMINI_429 = [{ error: { code: 429, message: "You exceeded your current quota, please check your plan and billing details.", status: "RESOURCE_EXHAUSTED" } }];
const OPENAI_QUOTA = { error: { message: "You exceeded your current quota.", type: "insufficient_quota", code: "insufficient_quota" } };
const OPENAI_STRICT_SCHEMA = { error: { message: "Invalid schema for response_format 'recipe': In context=(), 'required' is required to be supplied and to be an array including every key in properties. Missing 'subtitle'.", type: "invalid_request_error", code: null } };

describe("readErrorBody", () => {
  it("reads the OpenAI / OpenRouter / Anthropic shape", () => {
    expect(readErrorBody(OPENAI_401)).toEqual({ message: OPENAI_401.error.message, code: "invalid_api_key" });
  });
  it("reads Gemini's array shape", () => {
    expect(readErrorBody(GEMINI_400).message).toMatch(/API key not valid/);
  });
  it("reads xAI's string error", () => {
    expect(readErrorBody(XAI_400)).toEqual({ message: XAI_400.error, code: "invalid-argument" });
  });
  it("reads Mistral's detail", () => {
    expect(readErrorBody(MISTRAL_401).message).toBe("Invalid API Key");
  });
  it("falls back to plain text, clipped to 200 characters", () => {
    expect(readErrorBody("x".repeat(500)).message).toHaveLength(200);
  });
});

describe("classifyResponse", () => {
  it.each([
    [401, OPENAI_401, "auth"],
    [400, GEMINI_400, "auth"],
    [400, XAI_400, "auth"],
    [401, MISTRAL_401, "auth"],
    [403, {}, "auth"],
    [402, OPENROUTER_402, "billing"],
    [400, ANTHROPIC_LOW_BALANCE, "billing"],
    [429, OPENAI_QUOTA, "billing"],
    [429, GEMINI_429, "rate"],
    [429, {}, "rate"],
    [503, {}, "overloaded"],
    [529, {}, "overloaded"],
    [500, {}, "server"],
    [502, {}, "server"],
    [400, OPENAI_STRICT_SCHEMA, "rejected"],
    [404, {}, "rejected"],
    [408, {}, "rejected"],
    [422, { detail: [{ msg: "bad" }] }, "rejected"],
  ])("HTTP %i → %s", (status, body, kind) => {
    expect(classifyResponse(status, body).kind).toBe(kind);
  });

  it("carries the vendor's message as detail", () => {
    expect(classifyResponse(400, OPENAI_STRICT_SCHEMA).detail).toMatch(/Invalid schema/);
  });
});

describe("ProviderError", () => {
  const ctx: ErrorContext = {
    label: "OpenAI",
    host: "api.openai.com",
    model: "gpt-6-luna",
    custom: false,
    url: "https://api.openai.com/v1/chat/completions",
  };

  it("carries kind, status, detail and who was called", () => {
    const e = new ProviderError("auth", ctx, { status: 401, detail: "bad key" });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ProviderError");
    expect([e.kind, e.status, e.detail, e.label, e.host, e.model, e.custom, e.url]).toEqual([
      "auth", 401, "bad key", "OpenAI", "api.openai.com", "gpt-6-luna", false, ctx.url,
    ]);
  });

  it("defaults status to null and detail to empty", () => {
    const e = new ProviderError("network", ctx);
    expect(e.status).toBeNull();
    expect(e.detail).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root extension tests/provider-errors.test.ts`
Expected: FAIL, cannot resolve `../src/lib/providers/errors`.

- [ ] **Step 3: Implement** — `extension/src/lib/providers/errors.ts`

```ts
/**
 * One error type for every vendor, so the error card maps a *kind* to copy
 * and never has to know that Gemini answers a bad key with HTTP 400 while
 * OpenAI uses 401. Each adapter classifies; popup/errors.ts only words it.
 */

export type ProviderErrorKind =
  | "auth"
  | "billing"
  | "rate"
  | "overloaded"
  | "rejected"
  | "server"
  | "network"
  | "timeout"
  | "truncated"
  | "malformed";

/** Who was being called, so the error card can name them. */
export interface ErrorContext {
  label: string;
  host: string;
  model: string;
  /** A Custom endpoint: no Fast/Thorough menu, and a 404 usually means a wrong URL. */
  custom: boolean;
  /** The full endpoint that was called. */
  url: string;
}

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status: number | null;
  readonly detail: string;
  readonly label: string;
  readonly host: string;
  readonly model: string;
  readonly custom: boolean;
  readonly url: string;

  constructor(
    kind: ProviderErrorKind,
    ctx: ErrorContext,
    { status = null, detail = "" }: { status?: number | null; detail?: string } = {},
  ) {
    super(`${ctx.label} ${kind}${status ? ` (HTTP ${status})` : ""}${detail ? `: ${detail}` : ""}`);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
    this.label = ctx.label;
    this.host = ctx.host;
    this.model = ctx.model;
    this.custom = ctx.custom;
    this.url = ctx.url;
  }
}

const clip = (text: string) => text.slice(0, 200);

/**
 * One message out of any vendor's error body:
 *   { error: { message, code, type } }   OpenAI, OpenRouter, Anthropic
 *   [{ error: { message, code, status } }] Gemini
 *   { code, error: "…" }                  xAI
 *   { detail: "…" | [...] }               Mistral
 */
export function readErrorBody(body: unknown): { message: string; code: string | number | null } {
  if (typeof body === "string") return { message: clip(body), code: null };
  const first = Array.isArray(body) ? body[0] : body;
  if (first && typeof first === "object") {
    const o = first as Record<string, unknown>;
    if (o.error && typeof o.error === "object") {
      const e = o.error as Record<string, unknown>;
      const code = (e.code ?? e.type ?? e.status ?? null) as string | number | null;
      return { message: clip(String(e.message ?? "")), code };
    }
    if (typeof o.error === "string") {
      return { message: clip(o.error), code: (o.code ?? null) as string | number | null };
    }
    if (typeof o.detail === "string") return { message: clip(o.detail), code: null };
    if (o.detail !== undefined) return { message: clip(JSON.stringify(o.detail)), code: null };
    if (typeof o.message === "string") {
      return { message: clip(o.message), code: (o.code ?? null) as string | number | null };
    }
  }
  return { message: clip(JSON.stringify(body) ?? ""), code: null };
}

/**
 * First match wins. `invalid.*key` is deliberately not an auth pattern:
 * OpenAI's strict-schema 400 ("…every key in properties…") would match it.
 */
export function classifyResponse(
  status: number,
  body: unknown,
): { kind: ProviderErrorKind; detail: string } {
  const { message, code } = readErrorBody(body);
  const kind: ProviderErrorKind =
    status === 401 || status === 403
      ? "auth"
      : status === 402 ||
          code === "insufficient_quota" ||
          (status === 400 && /credit balance|billing/i.test(message))
        ? "billing"
        : status === 400 && /api[ _-]?key/i.test(message)
          ? "auth" // Gemini and xAI answer a bad key with 400
          : status === 429
            ? "rate" // Gemini's per-minute 429 mentions quota and billing; still a rate limit
            : status === 503 || status === 529
              ? "overloaded"
              : status >= 500
                ? "server"
                : "rejected";
  return { kind, detail: message };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --root extension tests/provider-errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/providers/errors.ts extension/tests/provider-errors.test.ts
git commit -m "Add ProviderError and one classifier for every vendor's error shape"
```

---

### Task 3: The vendor-independent core — extract.ts helpers

Moves `RECIPE_SCHEMA`, `buildPrompt` and `OffMenuError` out of `lib/anthropic.ts` into `lib/extract.ts` and adds `toNullableSchema`, `validateOutput`, `sampleFrames`. `lib/anthropic.ts` imports the moved pieces from `extract.ts` until Task 5 deletes it.

**Files:**
- Create: `extension/src/lib/extract.ts`
- Modify: `extension/src/lib/anthropic.ts` (delete the moved code, import it instead)
- Test: `extension/tests/extract-core.test.ts`; move the `RECIPE_SCHEMA` and `buildPrompt` describes out of `extension/tests/anthropic.test.ts` into it.

**Interfaces:**
- Consumes: `ProviderError`, `ErrorContext` (Task 2).
- Produces: `OffMenuError`, `RECIPE_SCHEMA`, `buildPrompt(payload, units)`, `type JsonSchema`, `toNullableSchema(schema: JsonSchema): JsonSchema`, `type ParsedRecipe = Omit<Recipe, "tags"> & { found: boolean; tags: string[] }`, `validateOutput(raw: unknown, ctx: ErrorContext): ParsedRecipe`, `sampleFrames<T>(frames: T[], max: number): T[]`.

- [ ] **Step 1: Write the failing test** — `extension/tests/extract-core.test.ts`

Start the file with the two describes cut from `tests/anthropic.test.ts` (`describe("RECIPE_SCHEMA", …)` and `describe("buildPrompt", …)`, with their `payload` const), importing from `../src/lib/extract` instead. Then append:

```ts
import {
  RECIPE_SCHEMA,
  sampleFrames,
  toNullableSchema,
  validateOutput,
  type JsonSchema,
} from "../src/lib/extract";
import { ProviderError, type ErrorContext } from "../src/lib/providers/errors";

const ctx: ErrorContext = {
  label: "OpenAI", host: "api.openai.com", model: "gpt-6-luna", custom: false,
  url: "https://api.openai.com/v1/chat/completions",
};

describe("toNullableSchema", () => {
  const before = structuredClone(RECIPE_SCHEMA);
  const out = toNullableSchema(RECIPE_SCHEMA as unknown as JsonSchema);

  it("lists every property as required, at every level", () => {
    expect([...(out.required ?? [])].sort()).toEqual(Object.keys(out.properties!).sort());
    const item = out.properties!.ingredients!.items!;
    expect([...(item.required ?? [])].sort()).toEqual(["item", "qty"]);
  });

  it("makes exactly the five optional fields nullable", () => {
    const nullable = Object.entries(out.properties!)
      .filter(([, p]) => Array.isArray(p.type))
      .map(([name]) => name)
      .sort();
    expect(nullable).toEqual(["author", "hands_on", "notes", "subtitle", "total"]);
    expect(out.properties!.subtitle!.type).toEqual(["string", "null"]);
    expect(out.properties!.notes!.type).toEqual(["array", "null"]);
  });

  it("never mutates RECIPE_SCHEMA", () => {
    expect(RECIPE_SCHEMA).toEqual(before);
  });
});

describe("validateOutput", () => {
  const good = {
    found: true, title: "T", subtitle: null, author: null, serves: "2",
    hands_on: null, total: "1h", ingredients: [{ qty: "1", item: "x" }],
    method: ["y"], notes: null, tags: ["pork"],
  };

  it("turns nulls into absent fields", () => {
    const r = validateOutput(good, ctx);
    expect(r.subtitle).toBeUndefined();
    expect(r.notes).toBeUndefined();
    expect(r.total).toBe("1h");
  });

  it("accepts found:false with empty fields", () => {
    expect(validateOutput({ found: false, title: "", serves: "", ingredients: [], method: [], tags: [] }, ctx).found).toBe(false);
  });

  it.each([
    ["a non-boolean found", { ...good, found: "yes" }],
    ["a missing title", { ...good, title: undefined }],
    ["ingredients that are not a list", { ...good, ingredients: "lots" }],
    ["an ingredient without qty", { ...good, ingredients: [{ item: "x" }] }],
    ["a method that is not strings", { ...good, method: [1] }],
    ["a non-object", "{}"],
  ])("rejects %s as malformed", (_, raw) => {
    try {
      validateOutput(raw, ctx);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect((e as ProviderError).kind).toBe("malformed");
    }
  });
});

describe("sampleFrames", () => {
  const frames = Array.from({ length: 24 }, (_, i) => `f${i}`);

  it("returns the same array when already under the cap", () => {
    const few = frames.slice(0, 5);
    expect(sampleFrames(few, 8)).toBe(few);
  });

  it("spreads 24 frames down to 8, first and last kept, in order", () => {
    expect(sampleFrames(frames, 8)).toEqual(["f0", "f3", "f7", "f10", "f13", "f16", "f20", "f23"]);
  });

  it("keeps the middle frame when the cap is 1", () => {
    expect(sampleFrames(frames, 1)).toEqual(["f11"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root extension tests/extract-core.test.ts`
Expected: FAIL, cannot resolve `../src/lib/extract`.

- [ ] **Step 3: Implement** — create `extension/src/lib/extract.ts`

Move `OffMenuError`, `RECIPE_SCHEMA` and `buildPrompt` verbatim from `lib/anthropic.ts` (with their doc comments and the `tags`/`page-source`/`types` imports they need), then add:

```ts
import { ProviderError, type ErrorContext } from "./providers/errors";
import type { Recipe } from "./types";

/** A JSON Schema node, as far as this module walks it. */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  [keyword: string]: unknown;
}

/**
 * The schema the Chat Completions path sends. OpenAI's strict mode requires
 * every property in `required`, with optional ones expressed as nullable;
 * Gemini and xAI accept the same. The Anthropic path keeps RECIPE_SCHEMA.
 */
export function toNullableSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...schema };
  if (schema.properties) {
    const required = new Set(schema.required ?? []);
    const properties: Record<string, JsonSchema> = {};
    for (const [name, prop] of Object.entries(schema.properties)) {
      const rewritten = toNullableSchema(prop);
      properties[name] = required.has(name)
        ? rewritten
        : { ...rewritten, type: [rewritten.type as string, "null"] };
    }
    out.properties = properties;
    out.required = Object.keys(schema.properties);
  }
  if (schema.items) out.items = toNullableSchema(schema.items);
  return out;
}

export type ParsedRecipe = Omit<Recipe, "tags"> & { found: boolean; tags: string[] };

/**
 * Claude's structured output is guaranteed to match the schema; not every
 * OpenAI-compatible vendor makes that promise. Check the shape before it
 * reaches the card, and turn strict mode's nulls back into absent fields.
 */
export function validateOutput(raw: unknown, ctx: ErrorContext): ParsedRecipe {
  const fail = (detail: string) => new ProviderError("malformed", ctx, { detail });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw fail("reply is not an object");
  const o = raw as Record<string, unknown>;
  if (typeof o.found !== "boolean") throw fail("found is not true or false");
  if (!o.found) {
    return { found: false, title: "", serves: "", ingredients: [], method: [], tags: [] };
  }

  const str = (key: string): string => {
    if (typeof o[key] !== "string") throw fail(`${key} is not text`);
    return o[key] as string;
  };
  const optStr = (key: string): string | undefined => {
    const v = o[key];
    if (v === null || v === undefined) return undefined;
    if (typeof v !== "string") throw fail(`${key} is not text`);
    return v;
  };
  const strList = (key: string): string[] => {
    const v = o[key];
    if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) {
      throw fail(`${key} is not a list of text`);
    }
    return v as string[];
  };
  const optStrList = (key: string): string[] | undefined =>
    o[key] === null || o[key] === undefined ? undefined : strList(key);

  const ingredients = o.ingredients;
  if (
    !Array.isArray(ingredients) ||
    !ingredients.every(
      (i) => i && typeof i === "object" && typeof i.qty === "string" && typeof i.item === "string",
    )
  ) {
    throw fail("ingredients are not qty/item pairs");
  }

  return {
    found: true,
    title: str("title"),
    subtitle: optStr("subtitle"),
    author: optStr("author"),
    serves: str("serves"),
    hands_on: optStr("hands_on"),
    total: optStr("total"),
    ingredients: ingredients.map((i: { qty: string; item: string }) => ({ qty: i.qty, item: i.item })),
    method: strList("method"),
    notes: optStrList("notes"),
    tags: strList("tags"),
  };
}

/**
 * Evenly spaced, first and last kept, order preserved. Mistral takes at most
 * 8 images, so a 24-frame Reel has to be thinned rather than cut off.
 */
export function sampleFrames<T>(frames: T[], max: number): T[] {
  if (frames.length <= max) return frames;
  if (max <= 0) return [];
  if (max === 1) return [frames[Math.floor((frames.length - 1) / 2)]!];
  return Array.from(
    { length: max },
    (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]!,
  );
}
```

In `extension/src/lib/anthropic.ts`, delete the moved `OffMenuError`, `RECIPE_SCHEMA` and `buildPrompt`, and add at the top:

```ts
import { buildPrompt, OffMenuError, RECIPE_SCHEMA } from "./extract";
export { buildPrompt, OffMenuError, RECIPE_SCHEMA };
```

so `popup.ts` and the remaining tests keep compiling until Task 5.

- [ ] **Step 4: Run tests and type-check**

Run: `npm run test:ext && npx tsc --noEmit -p extension/tsconfig.json`
Expected: all PASS (234 + the new ones, minus none), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/extract.ts extension/src/lib/anthropic.ts extension/tests/extract-core.test.ts extension/tests/anthropic.test.ts
git commit -m "Move the vendor-independent extraction core into extract.ts"
```

---

### Task 4: Settings migration and resolveConnection

**Files:**
- Create: `extension/src/lib/providers/connection.ts`
- Modify: `extension/src/lib/storage.ts` (Settings, DEFAULTS, getSettings)
- Modify: `extension/src/popup/views/prep.ts` (Model select now reads/writes `tier`; minimal, so the build stays green — Task 7 rebuilds Prep)
- Modify: `extension/src/popup/popup.ts:311` (temporary: `model: resolveConnection(settings).model`)
- Test: `extension/tests/connection.test.ts`; modify `extension/tests/storage.test.ts`

**Interfaces:**
- Consumes: `PRESETS`, `CUSTOM_DEFAULTS`, `normalizeBaseURL`, `detectProvider`, `ProviderId`, `Tier`, `Protocol`, `Preset` (Task 1); `ErrorContext` (Task 2).
- Produces: `ConnectionSettings { apiKey; provider: ProviderId; tier: Tier; baseURL: string; customModel: string }`, `Connection`, `ModelRequest { prompt; frames: string[]; schema: object; maxTokens: number }`, `CUSTOM_LABEL = "Your provider"`, `resolveConnection(s: ConnectionSettings): Connection`, `endpointOf(c): string`, `contextOf(c): ErrorContext`. `Settings` now `{ apiKey, provider, tier, baseURL, customModel, units, captureFrames, pulseOnDetect }` with no `model`.

- [ ] **Step 1: Write the failing tests**

`extension/tests/connection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contextOf, endpointOf, resolveConnection, type ConnectionSettings } from "../src/lib/providers/connection";
import { PRESETS, type PresetId } from "../src/lib/providers/presets";

const base: ConnectionSettings = { apiKey: "k", provider: "anthropic", tier: "fast", baseURL: "", customModel: "" };

describe("resolveConnection", () => {
  it.each(Object.keys(PRESETS) as PresetId[])("resolves the %s preset on both tiers", (id) => {
    for (const tier of ["fast", "thorough"] as const) {
      const c = resolveConnection({ ...base, provider: id, tier });
      expect(c.model).toBe(PRESETS[id].models[tier]);
      expect(c.label).toBe(PRESETS[id].label);
      expect(c.protocol).toBe(PRESETS[id].protocol);
      expect(c.maxImages).toBe(PRESETS[id].maxImages);
    }
  });

  it("resolves Custom from the user's URL and model, normalising the URL", () => {
    const c = resolveConnection({
      ...base, provider: "custom", apiKey: "",
      baseURL: "http://localhost:11434/v1/chat/completions", customModel: " llama3.3 ",
    });
    expect(c).toMatchObject({
      provider: "custom", label: "Your provider", host: "localhost:11434",
      protocol: "openai", baseURL: "http://localhost:11434/v1", model: "llama3.3",
      apiKey: "", strict: false, tokenParam: "max_tokens",
    });
    expect(endpointOf(c)).toBe("http://localhost:11434/v1/chat/completions");
    expect(contextOf(c).custom).toBe(true);
  });

  it("refuses a Custom provider with no URL or no model", () => {
    expect(() => resolveConnection({ ...base, provider: "custom", customModel: "m" })).toThrow(/base URL/);
    expect(() => resolveConnection({ ...base, provider: "custom", baseURL: "https://x.test/v1" })).toThrow(/model ID/);
    expect(() => resolveConnection({ ...base, provider: "custom", baseURL: "ftp://x.test", customModel: "m" })).toThrow();
  });

  it("names Anthropic's endpoint for the error card", () => {
    expect(endpointOf(resolveConnection(base))).toBe("https://api.anthropic.com/v1/messages");
  });

  it("copies extraBody so a caller cannot mutate the preset", () => {
    const c = resolveConnection({ ...base, provider: "openrouter" });
    (c.extraBody as Record<string, unknown>).x = 1;
    expect(PRESETS.openrouter.extraBody).not.toHaveProperty("x");
  });
});
```

In `extension/tests/storage.test.ts`, replace the defaults expectation and the `model` assertion, and add a migration block:

```ts
  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual({
      apiKey: "",
      provider: "anthropic",
      tier: "fast",
      baseURL: "",
      customModel: "",
      units: "metric",
      captureFrames: true,
      pulseOnDetect: true,
    });
  });
```

and in "merges a patch without clobbering other fields" change the last line to `expect(settings.tier).toBe("fast");`. Then add:

```ts
describe("settings migration", () => {
  it.each([
    ["claude-haiku-4-5", "fast"],
    ["claude-opus-5", "thorough"],
  ])("reads a stored model %s as Anthropic + %s", async (model, tier) => {
    installChromeMock({ "mise:settings": { apiKey: "sk-ant-x", model, units: "imperial" } });
    const s = await getSettings();
    expect(s.provider).toBe("anthropic");
    expect(s.tier).toBe(tier);
    expect(s.units).toBe("imperial");
    expect(s).not.toHaveProperty("model");
  });

  it("writes the new shape on the next save, with no model key", async () => {
    const local = installChromeMock({ "mise:settings": { apiKey: "sk-ant-x", model: "claude-opus-5" } });
    await setSettings({ units: "imperial" });
    const stored = local["mise:settings"] as Record<string, unknown>;
    expect(stored).not.toHaveProperty("model");
    expect(stored.tier).toBe("thorough");
  });

  it("never overrides a stored provider", async () => {
    installChromeMock({ "mise:settings": { apiKey: "sk-x", provider: "openai", tier: "fast", model: "claude-opus-5" } });
    const s = await getSettings();
    expect(s.provider).toBe("openai");
    expect(s.tier).toBe("fast");
  });
});

describe("dev key seed", () => {
  it("lets the provider follow the seeded key", async () => {
    vi.stubGlobal("__MISE_DEV_KEY__", "sk-proj-seeded");
    installChromeMock({ "mise:settings": { model: "claude-haiku-4-5" } });
    const s = await getSettings();
    expect(s.apiKey).toBe("sk-proj-seeded");
    expect(s.provider).toBe("openai");
  });

  it("never seeds a Custom provider, which may be keyless on purpose", async () => {
    vi.stubGlobal("__MISE_DEV_KEY__", "sk-ant-seeded");
    installChromeMock({ "mise:settings": { provider: "custom", baseURL: "http://localhost:11434/v1", customModel: "m" } });
    const s = await getSettings();
    expect(s.apiKey).toBe("");
    expect(s.provider).toBe("custom");
  });
});
```

Confirm `installChromeMock` returns the `local` store object (its doc comment says it does); if its return shape differs, read `tests/helpers/chrome-mock.ts` and adapt the `local[...]` access, not the helper.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --root extension tests/connection.test.ts tests/storage.test.ts`
Expected: FAIL (missing module; defaults mismatch).

- [ ] **Step 3: Implement**

`extension/src/lib/providers/connection.ts`:

```ts
import {
  CUSTOM_DEFAULTS,
  normalizeBaseURL,
  PRESETS,
  type Preset,
  type PresetId,
  type Protocol,
  type ProviderId,
  type Tier,
} from "./presets";
import type { ErrorContext } from "./errors";

/** The slice of Settings a connection is built from. */
export interface ConnectionSettings {
  apiKey: string;
  provider: ProviderId;
  tier: Tier;
  baseURL: string;
  customModel: string;
}

/** Everything an adapter needs, and nothing it would have to look up. */
export interface Connection {
  provider: ProviderId;
  label: string;
  host: string;
  protocol: Protocol;
  baseURL: string;
  apiKey: string;
  model: string;
  maxImages: number;
  tokenParam: Preset["tokenParam"];
  strict: boolean;
  extraBody: Record<string, unknown>;
}

export interface ModelRequest {
  prompt: string;
  /** Already sampled to the connection's maxImages. */
  frames: string[];
  schema: object;
  maxTokens: number;
}

export const CUSTOM_LABEL = "Your provider";

const MISSING_CUSTOM = "A custom provider needs a base URL and a model ID. Open Prep to add them.";

export function resolveConnection(s: ConnectionSettings): Connection {
  const apiKey = s.apiKey.trim();

  if (s.provider === "custom") {
    const baseURL = normalizeBaseURL(s.baseURL);
    const model = s.customModel.trim();
    let host = "";
    try {
      const url = new URL(baseURL);
      if (url.protocol === "http:" || url.protocol === "https:") host = url.host;
    } catch {
      host = "";
    }
    if (!host || !model) throw new Error(MISSING_CUSTOM);
    return {
      provider: "custom",
      label: CUSTOM_LABEL,
      host,
      protocol: CUSTOM_DEFAULTS.protocol,
      baseURL,
      apiKey,
      model,
      maxImages: CUSTOM_DEFAULTS.maxImages,
      tokenParam: CUSTOM_DEFAULTS.tokenParam,
      strict: CUSTOM_DEFAULTS.strict,
      extraBody: {},
    };
  }

  // A corrupted stored id falls back to Anthropic rather than crashing the popup.
  const p = PRESETS[s.provider as PresetId] ?? PRESETS.anthropic;
  return {
    provider: p.id,
    label: p.label,
    host: p.host,
    protocol: p.protocol,
    baseURL: p.baseURL,
    apiKey,
    model: p.models[s.tier] ?? p.models.fast,
    maxImages: p.maxImages,
    tokenParam: p.tokenParam,
    strict: p.strict,
    extraBody: structuredClone(p.extraBody),
  };
}

export function endpointOf(c: Connection): string {
  return c.protocol === "anthropic"
    ? "https://api.anthropic.com/v1/messages"
    : `${c.baseURL}/chat/completions`;
}

export function contextOf(c: Connection): ErrorContext {
  return {
    label: c.label,
    host: c.host,
    model: c.model,
    custom: c.provider === "custom",
    url: endpointOf(c),
  };
}
```

`extension/src/lib/storage.ts` — replace the `Settings` interface, `DEFAULTS` and `getSettings`:

```ts
import { detectProvider, type ProviderId, type Tier } from "./providers/presets";

export interface Settings {
  apiKey: string;
  provider: ProviderId;
  tier: Tier;
  /** Custom only. Kept when another provider is chosen, so switching back loses nothing. */
  baseURL: string;
  /** Custom only. */
  customModel: string;
  units: Units;
  captureFrames: boolean;
  /** Whether a detected recipe pulses the toolbar icon. */
  pulseOnDetect: boolean;
}

const DEFAULTS: Settings = {
  apiKey: "",
  provider: "anthropic",
  tier: "fast",
  baseURL: "",
  customModel: "",
  units: "metric",
  captureFrames: true,
  pulseOnDetect: true,
};

/** Settings before 2026-10-01 stored a model ID instead of provider + tier. */
type StoredSettings = Partial<Settings> & { model?: unknown };

/**
 * Decided on the raw stored object: after DEFAULTS are merged, provider and
 * tier always exist and "nothing stored" can no longer be told apart.
 */
function migrate(raw: StoredSettings): Partial<Settings> {
  const { model, ...rest } = raw;
  if (rest.provider === undefined && typeof model === "string") {
    return {
      ...rest,
      provider: "anthropic",
      tier: rest.tier ?? (model.includes("opus") ? "thorough" : "fast"),
    };
  }
  return rest;
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY_SETTINGS);
  const raw = (stored[KEY_SETTINGS] as StoredSettings | undefined) ?? {};
  const settings: Settings = { ...DEFAULTS, ...migrate(raw) };
  // Seed a dev key only when nothing is stored — never override a real one the
  // user typed, so a --dev build behaves normally once Prep has been saved.
  // The typeof guard matters: this is a build-time define, so the identifier
  // simply does not exist under vitest, and a bare reference would throw.
  // The provider follows the seeded key, so a migrated "anthropic" can never
  // sit beside a seeded OpenAI key. Custom may be keyless on purpose.
  const seed = typeof __MISE_DEV_KEY__ === "string" ? __MISE_DEV_KEY__ : "";
  if (!settings.apiKey && seed && settings.provider !== "custom") {
    settings.apiKey = seed;
    settings.provider = detectProvider(seed) ?? settings.provider;
  }
  return settings;
}
```

Keep the existing `declare const __MISE_DEV_KEY__` and its comment above `getSettings`.

`extension/src/popup/views/prep.ts` — minimal, Task 7 replaces this file: change the Model `<select>` options to

```html
<option value="fast">Fast — cheapest per recipe</option>
<option value="thorough">Thorough — slower, best on messy sources</option>
```

change `model.value = settings.model;` to `model.value = settings.tier;`, and in `save()` change `model: model.value,` to `tier: model.value as Tier,` (import `type Tier` from `../../lib/providers/presets`).

`extension/src/popup/popup.ts` — temporary, Task 5 replaces it: import `resolveConnection` from `../lib/providers/connection` and change `model: settings.model,` to `model: resolveConnection(settings).model,`.

- [ ] **Step 4: Run tests and type-check**

Run: `npm run test:ext && npx tsc --noEmit -p extension/tsconfig.json`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/providers/connection.ts extension/src/lib/storage.ts extension/src/popup/views/prep.ts extension/src/popup/popup.ts extension/tests/connection.test.ts extension/tests/storage.test.ts
git commit -m "Replace the stored model with provider + tier, migrating on read"
```

---

### Task 5: The two adapters, dispatch, and popup wiring

**Files:**
- Create: `extension/src/lib/providers/anthropic.ts`, `extension/src/lib/providers/openai-compat.ts`
- Modify: `extension/src/lib/extract.ts` (add `extractRecipe`)
- Delete: `extension/src/lib/anthropic.ts`
- Modify: `extension/src/popup/popup.ts` (imports, key check, `resolveConnection`, frame sampling, `extractRecipe` call)
- Test: `extension/tests/openai-compat.test.ts`, `extension/tests/anthropic-adapter.test.ts`; rename `extension/tests/anthropic.test.ts` → `extension/tests/extract.test.ts` and port it.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `AnthropicLike { messages: { parse(body: never): Promise<unknown> } }`, `createAnthropicClient(apiKey): AnthropicLike`, `callAnthropic(conn, req, client?)`, `buildBody(conn, req)`, `callOpenAICompat(conn, req, fetchImpl?)`, `extractRecipe(payload, { connection, units, frames?, transport? }): Promise<Recipe>`.

- [ ] **Step 1: Write the failing tests**

`extension/tests/openai-compat.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { callOpenAICompat, buildBody } from "../src/lib/providers/openai-compat";
import { resolveConnection, type ModelRequest } from "../src/lib/providers/connection";
import { ProviderError } from "../src/lib/providers/errors";

const conn = (provider: "openai" | "mistral" | "openrouter" | "gemini" = "openai", apiKey = "sk-proj-x") =>
  resolveConnection({ apiKey, provider, tier: "fast", baseURL: "", customModel: "" });
const custom = (apiKey = "") =>
  resolveConnection({ apiKey, provider: "custom", tier: "fast", baseURL: "http://localhost:11434/v1", customModel: "llama3.3" });

const req = (frames: string[] = []): ModelRequest => ({ prompt: "Extract.", frames, schema: { type: "object" }, maxTokens: 8000 });

const ok = (content: unknown, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content }, ...extra }] }), { status: 200 });

async function kindOf(p: Promise<unknown>) {
  try { await p; return "resolved"; } catch (e) { expect(e).toBeInstanceOf(ProviderError); return (e as ProviderError).kind; }
}

describe("buildBody", () => {
  it("sends a plain string when there are no frames", () => {
    const body = buildBody(conn(), req());
    expect((body.messages as Array<{ content: unknown }>)[0]!.content).toBe("Extract.");
  });

  it("puts image parts before the text, as data URLs", () => {
    const body = buildBody(conn(), req(["AAA", "BBB"]));
    const parts = (body.messages as Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>)[0]!.content;
    expect(parts.map((p) => p.type)).toEqual(["image_url", "image_url", "text"]);
    expect(parts[0]!.image_url!.url).toBe("data:image/jpeg;base64,AAA");
  });

  it("uses each preset's token parameter, strictness and extra body", () => {
    expect(buildBody(conn("openai"), req())).toMatchObject({ max_completion_tokens: 8000, reasoning_effort: "low" });
    expect(buildBody(conn("openai"), req())).not.toHaveProperty("max_tokens");
    expect((buildBody(conn("openai"), req()).response_format as { json_schema: { strict?: boolean } }).json_schema.strict).toBe(true);
    expect(buildBody(conn("mistral"), req())).toMatchObject({ max_tokens: 8000 });
    expect((buildBody(conn("mistral"), req()).response_format as { json_schema: object }).json_schema).not.toHaveProperty("strict");
    expect(buildBody(conn("openrouter"), req())).toMatchObject({ provider: { require_parameters: true } });
  });
});

describe("callOpenAICompat", () => {
  it("POSTs to {base}/chat/completions with a bearer key and returns the parsed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('{"found":false}'));
    expect(await callOpenAICompat(conn(), req(), fetchImpl)).toEqual({ found: false });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer sk-proj-x");
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("sends no Authorization header for a keyless local server", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('{"found":false}'));
    await callOpenAICompat(custom(), req(), fetchImpl);
    expect((fetchImpl.mock.calls[0]![1] as { headers: Record<string, string> }).headers).not.toHaveProperty("Authorization");
  });

  it("strips a markdown code fence some local models wrap JSON in", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('```json\n{"found":false}\n```'));
    expect(await callOpenAICompat(custom(), req(), fetchImpl)).toEqual({ found: false });
  });

  it("classifies a non-2xx by status and body", async () => {
    const body = { error: { message: "Incorrect API key provided", code: "invalid_api_key" } };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 401 }));
    expect(await kindOf(callOpenAICompat(conn(), req(), fetchImpl))).toBe("auth");
  });

  it("treats an error inside a 200 as a failure (OpenRouter does this)", async () => {
    const body = { error: { code: 502, message: "Upstream error" } };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    expect(await kindOf(callOpenAICompat(conn("openrouter", "sk-or-x"), req(), fetchImpl))).toBe("server");
  });

  it("reads finish_reason length as truncated", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"fo' } }] }), { status: 200 }),
    );
    expect(await kindOf(callOpenAICompat(conn(), req(), fetchImpl))).toBe("truncated");
  });

  it("reads a refusal as malformed, keeping the refusal", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: null, refusal: "I can't help with that." } }] }), { status: 200 }),
    );
    try { await callOpenAICompat(conn(), req(), fetchImpl); expect.unreachable(); }
    catch (e) { expect((e as ProviderError).kind).toBe("malformed"); expect((e as ProviderError).detail).toMatch(/can't help/); }
  });

  it("reads content that is not JSON as malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("Here is your recipe!"));
    expect(await kindOf(callOpenAICompat(conn(), req(), fetchImpl))).toBe("malformed");
  });

  it("reads a timeout as timeout, and any other fetch rejection as network", async () => {
    const timeout = vi.fn().mockRejectedValue(new DOMException("signal timed out", "TimeoutError"));
    expect(await kindOf(callOpenAICompat(custom(), req(), timeout))).toBe("timeout");
    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await kindOf(callOpenAICompat(custom(), req(), offline))).toBe("network");
  });
});
```

`extension/tests/anthropic-adapter.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { APIConnectionError, APIConnectionTimeoutError, APIError, AnthropicError } from "@anthropic-ai/sdk";
import { callAnthropic, type AnthropicLike } from "../src/lib/providers/anthropic";
import { resolveConnection } from "../src/lib/providers/connection";
import { ProviderError } from "../src/lib/providers/errors";

const conn = resolveConnection({ apiKey: "sk-ant-x", provider: "anthropic", tier: "fast", baseURL: "", customModel: "" });
const req = { prompt: "Extract.", frames: ["AAA"], schema: { type: "object" }, maxTokens: 8000 };

const client = (impl: () => Promise<unknown>): AnthropicLike => ({ messages: { parse: vi.fn(impl) } });

async function kindOf(p: Promise<unknown>) {
  try { await p; return "resolved"; } catch (e) { expect(e).toBeInstanceOf(ProviderError); return (e as ProviderError).kind; }
}

describe("callAnthropic", () => {
  it("returns parsed_output and sends images before the text", async () => {
    const c = client(async () => ({ parsed_output: { found: false }, stop_reason: "end_turn" }));
    expect(await callAnthropic(conn, req, c)).toEqual({ found: false });
    const body = (c.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      model: string; messages: Array<{ content: Array<{ type: string }> }>; output_config: unknown;
    };
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.messages[0]!.content.map((b) => b.type)).toEqual(["image", "text"]);
    expect(body).not.toHaveProperty("thinking");
  });

  it.each([
    ["a connection timeout", () => new APIConnectionTimeoutError(), "timeout"],
    ["a dropped connection", () => new APIConnectionError({ message: undefined }), "network"],
    ["a structured-output parse failure", () => new AnthropicError("Failed to parse structured output: bad"), "malformed"],
    ["a 529", () => new APIError(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, "Overloaded", new Headers()), "overloaded"],
    ["a 401", () => new APIError(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, "invalid", new Headers()), "auth"],
  ])("maps %s", async (_, make, kind) => {
    expect(await kindOf(callAnthropic(conn, req, client(async () => { throw make(); })))).toBe(kind);
  });

  it("reads stop_reason max_tokens as truncated", async () => {
    expect(await kindOf(callAnthropic(conn, req, client(async () => ({ parsed_output: null, stop_reason: "max_tokens" }))))).toBe("truncated");
  });

  it("reads a null parsed_output as malformed", async () => {
    expect(await kindOf(callAnthropic(conn, req, client(async () => ({ parsed_output: null, stop_reason: "end_turn" }))))).toBe("malformed");
  });
});
```

If `new Headers()` or any SDK constructor signature does not match the installed SDK (`node_modules/@anthropic-ai/sdk/core/error.d.ts`), adjust the test's construction to the real signature; do not change the adapter to fit a wrong test.

Port `extension/tests/anthropic.test.ts` → `git mv extension/tests/anthropic.test.ts extension/tests/extract.test.ts`, then in it:
- import `extractRecipe, OffMenuError` from `../src/lib/extract` and `resolveConnection` from `../src/lib/providers/connection`;
- add `const connection = resolveConnection({ apiKey: "k", provider: "anthropic", tier: "fast", baseURL: "", customModel: "" });`
- replace every `{ client, units: "metric", model: "m" }` (and the `model: "claude-haiku-4-5"` variant) with `{ connection, units: "metric", transport: { anthropic: client } }`, keeping `frames` where present;
- change "throws when structured output fails to parse" to expect a `ProviderError` of kind `malformed`:

```ts
  it("throws malformed when structured output is missing", async () => {
    const client = clientReturning(null);
    await expect(
      extractRecipe(payload, { connection, units: "metric", transport: { anthropic: client } }),
    ).rejects.toMatchObject({ name: "ProviderError", kind: "malformed" });
  });
```

and add one dispatch test for the second path:

```ts
  it("goes through Chat Completions with the nullable schema for a non-Anthropic provider", async () => {
    const openai = resolveConnection({ apiKey: "sk-proj-x", provider: "openai", tier: "fast", baseURL: "", customModel: "" });
    const content = JSON.stringify({
      found: true, title: "T", subtitle: null, author: null, serves: "2", hands_on: "25m",
      total: null, ingredients: [{ qty: "1", item: "x" }], method: ["y"], notes: null, tags: ["Pork"],
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200 }),
    );
    const recipe = await extractRecipe(payload, { connection: openai, units: "metric", transport: { fetch: fetchImpl } });
    expect(recipe.subtitle).toBeUndefined();
    expect(recipe.tags).toEqual(["#pork", "#weeknight"]);
    const sent = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(sent.response_format.json_schema.schema.required).toContain("subtitle");
  });

  it("samples frames down to the connection's cap", async () => {
    const mistral = resolveConnection({ apiKey: "m", provider: "mistral", tier: "fast", baseURL: "", customModel: "" });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"found":false}' } }] }), { status: 200 }),
    );
    await expect(
      extractRecipe(payload, { connection: mistral, units: "metric", frames: Array(24).fill("AAA"), transport: { fetch: fetchImpl } }),
    ).rejects.toBeInstanceOf(OffMenuError);
    const sent = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(sent.messages[0].content.filter((p: { type: string }) => p.type === "image_url")).toHaveLength(8);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --root extension tests/openai-compat.test.ts tests/anthropic-adapter.test.ts tests/extract.test.ts`
Expected: FAIL, missing modules / `extractRecipe` not exported from `extract`.

- [ ] **Step 3: Implement**

`extension/src/lib/providers/anthropic.ts`:

```ts
import Anthropic, {
  AnthropicError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "@anthropic-ai/sdk";
import { contextOf, type Connection, type ModelRequest } from "./connection";
import { classifyResponse, ProviderError, type ErrorContext } from "./errors";

/** The slice of the SDK client this module uses, so tests can inject a fake. */
export interface AnthropicLike {
  messages: { parse: (body: never) => Promise<unknown> };
}

export function createAnthropicClient(apiKey: string): AnthropicLike {
  return new Anthropic({
    apiKey,
    // The popup is a browser context; the API blocks browser origins unless
    // the caller opts in explicitly. BYOK means the key never leaves the device.
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
  }) as unknown as AnthropicLike;
}

/**
 * Claude's native Messages API with structured outputs. The SDK retries twice
 * on 429, 5xx and dropped connections; that ships today and is kept.
 */
export async function callAnthropic(
  conn: Connection,
  req: ModelRequest,
  client: AnthropicLike = createAnthropicClient(conn.apiKey),
): Promise<unknown> {
  const ctx = contextOf(conn);
  const content = [
    ...req.frames.map((data) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
    })),
    { type: "text" as const, text: req.prompt },
  ];

  let response: { parsed_output?: unknown; stop_reason?: string };
  try {
    // Haiku 4.5 supports structured outputs and vision, but not `effort` or
    // adaptive thinking — sending either is a 400.
    response = (await client.messages.parse({
      model: conn.model,
      max_tokens: req.maxTokens,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: req.schema } },
    } as never)) as typeof response;
  } catch (error) {
    throw toProviderError(error, ctx);
  }

  if (response.stop_reason === "max_tokens") throw new ProviderError("truncated", ctx);
  if (response.parsed_output == null) {
    throw new ProviderError("malformed", ctx, { detail: "no structured output" });
  }
  return response.parsed_output;
}

function toProviderError(error: unknown, ctx: ErrorContext): unknown {
  // Timeout first: it is a subclass of APIConnectionError.
  if (error instanceof APIConnectionTimeoutError) return new ProviderError("timeout", ctx);
  if (error instanceof APIConnectionError) return new ProviderError("network", ctx);
  if (error instanceof APIError && typeof error.status === "number") {
    const { kind, detail } = classifyResponse(error.status, error.error ?? error.message);
    return new ProviderError(kind, ctx, { status: error.status, detail });
  }
  if (error instanceof AnthropicError && /failed to parse structured output/i.test(error.message)) {
    return new ProviderError("malformed", ctx, { detail: error.message });
  }
  return error;
}
```

`extension/src/lib/providers/openai-compat.ts`:

```ts
import { contextOf, endpointOf, type Connection, type ModelRequest } from "./connection";
import { classifyResponse, ProviderError } from "./errors";

/** A stalled server must not leave the skeleton spinning forever. */
const TIMEOUT_MS = 120_000;

export function buildBody(conn: Connection, req: ModelRequest): Record<string, unknown> {
  // A plain string when there are no frames: some compatible servers reject
  // content-part arrays outright.
  const content =
    req.frames.length === 0
      ? req.prompt
      : [
          ...req.frames.map((b64) => ({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${b64}` },
          })),
          { type: "text", text: req.prompt },
        ];

  return {
    model: conn.model,
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "recipe", schema: req.schema, ...(conn.strict ? { strict: true } : {}) },
    },
    [conn.tokenParam]: req.maxTokens,
    ...conn.extraBody,
  };
}

/**
 * The OpenAI Chat Completions shape, which OpenAI, Gemini, xAI, Mistral,
 * OpenRouter and most local servers all speak. One attempt, no automatic
 * retry: the error card's RETRY is the retry.
 */
export async function callOpenAICompat(
  conn: Connection,
  req: ModelRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const ctx = contextOf(conn);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // A keyless local server gets no Authorization header at all.
  if (conn.apiKey) headers.Authorization = `Bearer ${conn.apiKey}`;

  let response: Response;
  try {
    response = await fetchImpl(endpointOf(conn), {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody(conn, req)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error || error instanceof DOMException ? error.name : "";
    const detail = error instanceof Error || error instanceof DOMException ? error.message : String(error);
    throw new ProviderError(name === "TimeoutError" ? "timeout" : "network", ctx, { detail });
  }

  const text = await response.text();
  const body = parseJson(text);

  if (!response.ok) {
    const { kind, detail } = classifyResponse(response.status, body ?? text);
    throw new ProviderError(kind, ctx, { status: response.status, detail });
  }

  // OpenRouter reports some upstream failures inside a 200.
  const bodyError = (body as { error?: { code?: unknown } } | undefined)?.error;
  if (bodyError) {
    const status = typeof bodyError.code === "number" ? bodyError.code : 502;
    const { kind, detail } = classifyResponse(status, body);
    throw new ProviderError(kind, ctx, { status, detail });
  }

  const choice = (body as {
    choices?: Array<{ finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }>;
  } | undefined)?.choices?.[0];

  if (choice?.finish_reason === "length") throw new ProviderError("truncated", ctx);

  const refusal = choice?.message?.refusal;
  if (typeof refusal === "string" && refusal) {
    throw new ProviderError("malformed", ctx, { detail: refusal });
  }

  const content = choice?.message?.content;
  if (typeof content !== "string") {
    throw new ProviderError("malformed", ctx, { detail: "no message content" });
  }

  // Some local models wrap JSON in a markdown fence even when asked not to.
  const unfenced = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = parseJson(unfenced);
  if (parsed === undefined) throw new ProviderError("malformed", ctx, { detail: "reply is not JSON" });
  return parsed;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
```

Append to `extension/src/lib/extract.ts`:

```ts
import { normalizeTags } from "./tags";
import type { ExtractionPayload } from "./page-source";
import type { Units } from "./types";
import { contextOf, type Connection, type ModelRequest } from "./providers/connection";
import { callAnthropic, type AnthropicLike } from "./providers/anthropic";
import { callOpenAICompat } from "./providers/openai-compat";

const MAX_TOKENS = 8000;

export interface ExtractOptions {
  connection: Connection;
  units: Units;
  /** Base64 JPEG frames, already downsampled to <=1568px on the long edge. */
  frames?: string[];
  /** Test seams only. */
  transport?: { fetch?: typeof fetch; anthropic?: AnthropicLike };
}

export async function extractRecipe(
  payload: ExtractionPayload,
  { connection, units, frames = [], transport = {} }: ExtractOptions,
): Promise<Recipe> {
  const request: ModelRequest = {
    prompt: buildPrompt(payload, units),
    frames: sampleFrames(frames, connection.maxImages),
    schema:
      connection.protocol === "anthropic"
        ? RECIPE_SCHEMA
        : toNullableSchema(RECIPE_SCHEMA as unknown as JsonSchema),
    maxTokens: MAX_TOKENS,
  };

  const raw =
    connection.protocol === "anthropic"
      ? await callAnthropic(connection, request, transport.anthropic)
      : await callOpenAICompat(connection, request, transport.fetch);

  const parsed = validateOutput(raw, contextOf(connection));
  if (!parsed.found || parsed.ingredients.length === 0) throw new OffMenuError();

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    author: parsed.author,
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

Merge the new imports into the file's existing import block rather than leaving a second one mid-file. `callAnthropic`'s default parameter creates the real client only when no fake is passed.

Delete `extension/src/lib/anthropic.ts` (`git rm`).

`extension/src/popup/popup.ts`:

```ts
import { extractRecipe, OffMenuError, sampleFrames } from "../lib/extract";
import { resolveConnection } from "../lib/providers/connection";
```

(replacing the `../lib/anthropic` import). In `run()`:

```ts
    const settings = await getSettings();
    // Custom may be a keyless local server; every preset needs a key.
    if (!settings.apiKey && settings.provider !== "custom") throw new NoKeyError();
    // Before the tab query and frame capture, so a configuration error never costs a capture.
    const connection = resolveConnection(settings);
```

In the capture block, sample before `via` is written so the `.md` records the frames the model saw:

```ts
        frames = sampleFrames(
          await captureFrames(tab.id, {
            crop: reply.videoRect,
            devicePixelRatio: reply.devicePixelRatio,
          }),
          connection.maxImages,
        );
        if (frames.length > 0) {
          payload.via = `${frames.length} video frames` as ViaMethod;
        }
```

and the extraction call:

```ts
    const recipe = await extractRecipe(payload, {
      connection,
      units: settings.units,
      frames,
    });
```

Remove the temporary `resolveConnection(settings).model` from Task 4.

Port the two existing live tests now, because `extension/tsconfig.json` includes `tests/**/*.ts` and they import the deleted module. In `extension/tests/live/extract.live.ts` and `extension/tests/live/vision.live.ts`, replace `import { createClient, extractRecipe … } from "../../src/lib/anthropic"` with imports from `../../src/lib/extract` plus `import { resolveConnection } from "../../src/lib/providers/connection";`, define

```ts
const connection = () => ({
  ...resolveConnection({ apiKey: key!, provider: "anthropic", tier: "fast", baseURL: "", customModel: "" }),
  model: LIVE_MODEL,
});
```

(in `extract.live.ts` this replaces `const client = () => createClient(key!);`), and replace every `client: client()` / `client: createClient(key!)` together with its `model: LIVE_MODEL` by `connection: connection()`. Assertions do not change.

- [ ] **Step 4: Run tests and type-check**

Run: `npm run test:ext && npx tsc --noEmit -p extension/tsconfig.json && grep -rn "lib/anthropic\"" extension/src extension/tests extension/scripts`
Expected: tests PASS, tsc clean, the grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A extension/src extension/tests
git commit -m "Dispatch extraction to Anthropic or any Chat Completions server"
```

---

### Task 6: Vendor-named error copy

**Files:**
- Modify: `extension/src/popup/errors.ts`
- Modify: `extension/tests/errors.test.ts`
- Modify: `extension/scripts/portfolio/render-portfolio.mjs:32-49`
- Modify: `type-specimens/popup-states.html` (03C card, around line 1749–1751)

**Interfaces:**
- Consumes: `ProviderError` (Task 2).
- Produces: `classify(error)` unchanged signature; `NoKeyError` unchanged.

- [ ] **Step 1: Write the failing test** — rewrite the `describe("classify", …)` block in `extension/tests/errors.test.ts`; keep the `renderError` describe, but change its fixture label from `"CLAUDE OVERLOADED"` to `"OVERLOADED"` in both places.

```ts
import { ProviderError, type ErrorContext, type ProviderErrorKind } from "../src/lib/providers/errors";

const preset: ErrorContext = {
  label: "OpenAI", host: "api.openai.com", model: "gpt-6-luna", custom: false,
  url: "https://api.openai.com/v1/chat/completions",
};
const custom: ErrorContext = {
  label: "Your provider", host: "localhost:11434", model: "llama3.3", custom: true,
  url: "http://localhost:11434/v1/chat/completions",
};
const err = (kind: ProviderErrorKind, status: number | null = null, ctx = preset, detail = "") =>
  new ProviderError(kind, ctx, { status, detail });

describe("classify", () => {
  it.each([
    ["auth", 401, "KEY REJECTED", false],
    ["billing", 402, "OUT OF CREDIT", true],
    ["rate", 429, "RATE LIMITED", true],
    ["overloaded", 529, "OVERLOADED", true],
    ["rejected", 400, "REQUEST REJECTED", false],
    ["server", 500, "UPSTREAM ERROR", true],
    ["network", null, "NETWORK DROP", true],
    ["timeout", null, "TIMED OUT", true],
    ["truncated", null, "REPLY CUT OFF", false],
    ["malformed", null, "PARSE FAILURE", true],
  ] as const)("%s → %s", (kind, status, label, canRetry) => {
    const c = classify(err(kind, status));
    expect(c.label).toBe(label);
    expect(c.canRetry).toBe(canRetry);
  });

  it("names the vendor in every provider failure", () => {
    for (const kind of ["auth", "billing", "rate", "overloaded", "server", "timeout", "truncated", "malformed"] as const) {
      expect(classify(err(kind, 500)).body).toContain("OpenAI");
    }
    expect(classify(err("network")).body).toContain("api.openai.com");
  });

  it("puts the HTTP status in the code slot", () => {
    expect(classify(err("overloaded", 503)).code).toBe("HTTP 503");
    expect(classify(err("auth", 400)).code).toBe("HTTP 400");
  });

  it("keeps the vendor's detail on a rejected request", () => {
    expect(classify(err("rejected", 400, preset, "effort is not supported")).body).toContain("effort is not supported");
  });

  it("blames the model on a preset 404, and the URL on a Custom 404", () => {
    expect(classify(err("rejected", 404)).body).toContain("gpt-6-luna");
    const c = classify(err("rejected", 404, custom));
    expect(c.body).toContain("http://localhost:11434/v1/chat/completions");
    expect(c.body).toMatch(/base URL/);
  });

  it("only offers Fast/Thorough where that menu exists", () => {
    expect(classify(err("overloaded", 529)).body).toMatch(/Fast and Thorough/);
    expect(classify(err("overloaded", 529, custom)).body).not.toMatch(/Fast and Thorough/);
    expect(classify(err("overloaded", 529, custom)).body).toMatch(/another model/);
  });

  it("recognises an unreachable content script", () => {
    expect(classify(new Error("Could not read this page.")).label).toBe("PAGE UNREADABLE");
  });

  it("treats a missing key as setup, without naming a vendor", () => {
    const c = classify(new NoKeyError());
    expect(c.label).toBe("NO API KEY");
    expect(c.code).toBe("SETUP");
    expect(c.canRetry).toBe(false);
    expect(c.body).not.toMatch(/Anthropic/);
  });

  it("falls back to the raw message rather than swallowing it", () => {
    const c = classify(new Error("A custom provider needs a base URL and a model ID. Open Prep to add them."));
    expect(c.label).toBe("EXTRACTION FAILED");
    expect(c.body).toMatch(/base URL/);
  });

  it("handles a thrown non-Error without crashing", () => {
    expect(classify("plain string").body).toBe("plain string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root extension tests/errors.test.ts`
Expected: FAIL (labels and bodies differ).

- [ ] **Step 3: Implement** — replace everything below `NoKeyError` in `extension/src/popup/errors.ts`:

```ts
import { ProviderError } from "../lib/providers/errors";

// (keep the Classified interface and the NoKeyError class as they are)

export function classify(error: unknown): Classified {
  if (error instanceof NoKeyError) {
    return {
      label: "NO API KEY",
      code: "SETUP",
      body: "Mise needs an API key from your AI provider. Open Prep, paste it in, and fire again.",
      canRetry: false,
    };
  }

  if (error instanceof ProviderError) return fromProvider(error);

  const message = error instanceof Error ? error.message : String(error);

  if (/could not read this page|receiving end/i.test(message)) {
    return {
      label: "PAGE UNREADABLE",
      code: "NO ACCESS",
      body: "Mise can't read this page. Reload it, or select the recipe text and right-click → Fire.",
      canRetry: true,
    };
  }

  return { label: "EXTRACTION FAILED", code: "ERROR", body: message, canRetry: true };
}

/**
 * Labels stay short and vendor-free — they are shouted in a narrow callout.
 * Bodies name the vendor, because "refused that key" means nothing until you
 * know who refused it.
 */
function fromProvider(e: ProviderError): Classified {
  const swap = e.custom ? "try another model in Prep" : "switch between Fast and Thorough in Prep";
  const http = `HTTP ${e.status ?? ""}`.trim();

  switch (e.kind) {
    case "auth":
      return {
        label: "KEY REJECTED",
        code: http,
        body: `${e.label} refused that key. Check it in Prep: it may be revoked, mistyped, or for a different provider.`,
        canRetry: false,
      };
    case "billing":
      return {
        label: "OUT OF CREDIT",
        code: http,
        body: `${e.label} says this account is out of credit. Top it up, then retry.`,
        canRetry: true,
      };
    case "rate":
      return {
        label: "RATE LIMITED",
        code: "HTTP 429",
        body: `You've hit your ${e.label} rate limit. Wait a moment, then retry.`,
        canRetry: true,
      };
    case "overloaded":
      return {
        label: "OVERLOADED",
        code: http,
        body: `${e.label}'s servers are busy. Retry in about 30 seconds, or ${swap}.`,
        canRetry: true,
      };
    case "rejected":
      if (e.status === 404) {
        return {
          label: "REQUEST REJECTED",
          code: "HTTP 404",
          body: e.custom
            ? `Nothing answered at ${e.url}. Check the base URL in Prep; it usually ends in /v1.`
            : `${e.label} doesn't serve the model ${e.model}. Check Prep.`,
          canRetry: false,
        };
      }
      return {
        label: "REQUEST REJECTED",
        code: http,
        body: `${e.label} rejected the request. ${e.detail}`.trim(),
        canRetry: false,
      };
    case "server":
      return {
        label: "UPSTREAM ERROR",
        code: http,
        body: `${e.label} had a server error. Retry in a moment.`,
        canRetry: true,
      };
    case "network":
      return {
        label: "NETWORK DROP",
        code: "OFFLINE",
        body: `Couldn't reach ${e.host}. Check your connection, then retry.`,
        canRetry: true,
      };
    case "timeout":
      return {
        label: "TIMED OUT",
        code: "TIMEOUT",
        body: `${e.label} didn't answer within 2 minutes. Retry, or ${swap}.`,
        canRetry: true,
      };
    case "truncated":
      return {
        label: "REPLY CUT OFF",
        code: "LENGTH",
        body: `${e.label} ran out of room before the recipe was finished. Retrying won't help; ${swap}.`,
        canRetry: false,
      };
    case "malformed":
      return {
        label: "PARSE FAILURE",
        code: "BAD SHAPE",
        body: `${e.label}'s reply didn't match the recipe shape. Retrying usually fixes it, or ${swap}.`,
        canRetry: true,
      };
  }
}
```

Delete the old `statusOf` helper and the status `switch`.

`extension/scripts/portfolio/render-portfolio.mjs`: add `export { ProviderError } from "./lib/providers/errors";` to the `stdin.contents` export list, and replace line 49 with:

```js
const overloaded = m.classify(
  new m.ProviderError(
    "overloaded",
    {
      label: "Anthropic",
      host: "api.anthropic.com",
      model: "claude-haiku-4-5",
      custom: false,
      url: "https://api.anthropic.com/v1/messages",
    },
    { status: 529 },
  ),
);
```

`type-specimens/popup-states.html`, the 03C error card: change the callout label text `CLAUDE OVERLOADED` to `OVERLOADED`, and its body `Claude's servers are busy right now. Retry in ~30s, or switch model in Prep.` to `Anthropic's servers are busy. Retry in about 30 seconds, or switch between Fast and Thorough in Prep.` Touch nothing else in the specimen.

- [ ] **Step 4: Run tests, type-check, and prove the port is unaffected**

Run: `npm run test:ext && npx tsc --noEmit -p extension/tsconfig.json && npm run port:design && git status --short extension/src/popup`
Expected: tests PASS, tsc clean, and `git status` shows **no** change to `popup.css` or `glyphs.ts` (the specimen change is text only).

Then: `npm run render:portfolio -- --out .scratch/portfolio-render` and open the error image it writes; Read it and confirm the callout says OVERLOADED and the body names Anthropic.

- [ ] **Step 5: Commit**

```bash
git add extension/src/popup/errors.ts extension/tests/errors.test.ts extension/scripts/portfolio/render-portfolio.mjs type-specimens/popup-states.html
git commit -m "Name the vendor in every error, and classify by kind instead of status"
```

---

### Task 7: Prep — provider menu, detection, Custom fields

**Files:**
- Modify: `extension/src/popup/views/prep.ts` (rewrite `mountPrep`; `submitPrep` unchanged)
- Modify: `extension/scripts/port-design.mjs` (Prep block selectors + `[hidden]` rule), then `npm run port:design`
- Test: `extension/tests/prep.test.ts`

**Interfaces:**
- Consumes: `getSettings`, `setSettings`, `Settings` (Task 4); `detectProvider`, `normalizeBaseURL`, `PRESETS`, `PROVIDER_IDS`, `PROVIDER_LABELS`, `ProviderId`, `Tier` (Task 1).
- Produces: `mountPrep(root)`, `submitPrep(root)` — same signatures as today.

- [ ] **Step 1: Write the failing test** — `extension/tests/prep.test.ts`

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import { mountPrep } from "../src/popup/views/prep";

const tick = () => new Promise((r) => setTimeout(r, 0));

let local: Record<string, unknown>;
let root: HTMLElement;

async function mount(seed: Record<string, unknown> = {}) {
  local = installChromeMock(seed) as Record<string, unknown>;
  root = document.createElement("div");
  document.body.replaceChildren(root);
  mountPrep(root);
  await tick();
  await tick();
}

const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
const type = (sel: string, value: string) => {
  const el = $<HTMLInputElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const choose = (value: string) => {
  const el = $<HTMLSelectElement>("#provider");
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
const save = async () => {
  $<HTMLFormElement>("#prep-form").dispatchEvent(new Event("submit", { cancelable: true }));
  await tick();
  await tick();
};
const stored = () => local["mise:settings"] as Record<string, unknown> | undefined;

beforeEach(() => vi.unstubAllGlobals());

describe("Prep", () => {
  it("offers every provider and starts on the empty-key hint with a key link", async () => {
    await mount();
    const options = [...root.querySelectorAll("#provider option")].map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(["anthropic", "openai", "gemini", "xai", "mistral", "openrouter", "custom"]);
    expect($("#key-hint").textContent).toMatch(/Works with Anthropic, OpenAI/);
    expect($<HTMLAnchorElement>("#key-hint a").href).toBe("https://console.anthropic.com/settings/keys");
  });

  it("sets the provider from a pasted key and names where it goes", async () => {
    await mount();
    type("#apiKey", "sk-proj-abc");
    expect($<HTMLSelectElement>("#provider").value).toBe("openai");
    expect($("#key-hint").textContent).toContain("api.openai.com");
  });

  it("never moves the menu off Custom (DeepSeek and others issue sk- keys)", async () => {
    await mount();
    choose("custom");
    type("#apiKey", "sk-deepseek-abc");
    expect($<HTMLSelectElement>("#provider").value).toBe("custom");
  });

  it("asks for a pick when the key has no known prefix, until one is picked", async () => {
    await mount();
    type("#apiKey", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6");
    expect($("#key-hint").textContent).toMatch(/Couldn't tell/);
    choose("mistral");
    expect($("#key-hint").textContent).toContain("api.mistral.ai");
  });

  it("shows Base URL and Model ID only on Custom, and hides the tier menu there", async () => {
    await mount();
    expect($("#baseURL-field").hidden).toBe(true);
    expect($("#tier-field").hidden).toBe(false);
    choose("custom");
    expect($("#baseURL-field").hidden).toBe(false);
    expect($("#customModel-field").hidden).toBe(false);
    expect($("#tier-field").hidden).toBe(true);
  });

  it("refuses an incomplete Custom and writes nothing", async () => {
    await mount();
    choose("custom");
    type("#baseURL", "localhost:11434");
    await save();
    expect(stored()).toBeUndefined();
    expect($("#prep-status").textContent).toMatch(/base URL and a model ID/);
  });

  it("saves Custom with the URL normalised, keyless", async () => {
    await mount();
    choose("custom");
    type("#baseURL", "http://localhost:11434/v1/chat/completions");
    type("#customModel", "llama3.3");
    await save();
    expect(stored()).toMatchObject({
      apiKey: "", provider: "custom", baseURL: "http://localhost:11434/v1", customModel: "llama3.3",
    });
    expect(stored()).not.toHaveProperty("model");
  });

  it("does not let a bad URL left under Custom block saving another provider", async () => {
    await mount();
    choose("custom");
    type("#baseURL", "not a url");
    choose("openai");
    type("#apiKey", "sk-proj-abc");
    await save();
    expect(stored()).toMatchObject({ provider: "openai", apiKey: "sk-proj-abc", tier: "fast" });
  });

  it("loads stored settings, including a migrated model", async () => {
    await mount({ "mise:settings": { apiKey: "sk-ant-x", model: "claude-opus-5" } });
    expect($<HTMLSelectElement>("#provider").value).toBe("anthropic");
    expect($<HTMLSelectElement>("#tier").value).toBe("thorough");
    expect($("#key-hint").textContent).toContain("api.anthropic.com");
  });
});
```

If `installChromeMock` does not return the `local` store, read `tests/helpers/chrome-mock.ts` and read stored values the way `storage.test.ts` does.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root extension tests/prep.test.ts`
Expected: FAIL (no `#provider`, no `#key-hint`).

- [ ] **Step 3: Implement** — replace `mountPrep` in `extension/src/popup/views/prep.ts` (keep the file's header comment and `submitPrep`):

```ts
import { getSettings, setSettings } from "../../lib/storage";
import {
  detectProvider,
  normalizeBaseURL,
  PRESETS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type PresetId,
  type ProviderId,
  type Tier,
} from "../../lib/providers/presets";
import type { Units } from "../../lib/types";

const STORED = "Stored on this device only.";
const VENDORS = "Anthropic, OpenAI, Gemini, Grok, Mistral, OpenRouter, or any OpenAI-compatible API";

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function httpHost(url: string): string {
  try {
    const u = new URL(normalizeBaseURL(url));
    return u.protocol === "http:" || u.protocol === "https:" ? u.host : "";
  } catch {
    return "";
  }
}

/** The line under the key field: where the key goes, or how to get one. */
function keyHint(id: ProviderId, key: string, baseURL: string, undetected: boolean): string {
  if (id === "custom") {
    const host = httpHost(baseURL);
    const where = host ? esc(host) : "the base URL below";
    return `${STORED} Sent to ${where} and nowhere else. Leave it empty if your server needs no key.`;
  }
  if (undetected) return "Couldn't tell which provider this key is for. Pick it below.";
  const p = PRESETS[id as PresetId];
  if (!key.trim()) {
    return (
      `${STORED} Works with ${VENDORS}. No key yet? ` +
      `<a href="${p.keyUrl}" target="_blank" rel="noreferrer noopener">Make one at ${p.label}</a>.`
    );
  }
  return `${STORED} Sent to ${p.host} and nowhere else. You pay ${p.label} directly.`;
}

export function mountPrep(root: HTMLElement): void {
  root.innerHTML = `
    <div class="ticket-top"><span class="brand">MISE · PREP</span></div>
    <form id="prep-form" novalidate>
      <label class="field">
        <span class="label">API key</span>
        <input id="apiKey" type="password" autocomplete="off" spellcheck="false"
               placeholder="Paste your key" />
        <span class="hint" id="key-hint"></span>
      </label>

      <label class="field">
        <span class="label">Provider</span>
        <select id="provider">
          ${PROVIDER_IDS.map((id) => `<option value="${id}">${PROVIDER_LABELS[id]}</option>`).join("")}
        </select>
      </label>

      <label class="field" id="baseURL-field" hidden>
        <span class="label">Base URL</span>
        <input id="baseURL" type="url" autocomplete="off" spellcheck="false"
               placeholder="https://…/v1" />
      </label>

      <label class="field" id="customModel-field" hidden>
        <span class="label">Model ID</span>
        <input id="customModel" type="text" autocomplete="off" spellcheck="false" />
      </label>

      <label class="field" id="tier-field">
        <span class="label">Model</span>
        <select id="tier">
          <option value="fast">Fast — cheapest per recipe</option>
          <option value="thorough">Thorough — slower, best on messy sources</option>
        </select>
      </label>

      <fieldset class="field">
        <legend class="label">Units</legend>
        <div class="radios">
          <label><input type="radio" name="units" value="metric" /> Metric</label>
          <label><input type="radio" name="units" value="imperial" /> Imperial</label>
        </div>
        <span class="hint">Mise converts by ingredient density, not naive math.</span>
      </fieldset>

      <label class="field checkbox">
        <input id="captureFrames" type="checkbox" />
        <span>Scan video frames on Reels, TikTok, and Shorts</span>
      </label>

      <label class="field checkbox explained">
        <input id="watchPages" type="checkbox" />
        <span>Pulse the icon when a page has a recipe</span>
        <span class="hint">
          Only pages that declare a recipe. Detection runs on this device and
          no page ever leaves it.
        </span>
      </label>
    </form>
    <p id="prep-status" class="status" role="status"></p>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const form = $<HTMLFormElement>("#prep-form");
  const apiKey = $<HTMLInputElement>("#apiKey");
  const hint = $<HTMLElement>("#key-hint");
  const provider = $<HTMLSelectElement>("#provider");
  const baseURL = $<HTMLInputElement>("#baseURL");
  const customModel = $<HTMLInputElement>("#customModel");
  const tier = $<HTMLSelectElement>("#tier");
  const captureFrames = $<HTMLInputElement>("#captureFrames");
  const watchPages = $<HTMLInputElement>("#watchPages");
  const status = $<HTMLElement>("#prep-status");

  const say = (text: string, hold = 4000) => {
    status.textContent = text;
    setTimeout(() => (status.textContent = ""), hold);
  };

  /** Set when a pasted key matched no prefix; cleared once a provider is picked. */
  let undetected = false;

  /*
   * Everything derived from the form lives here. Setting select.value from
   * script fires no change event, so the key handler calls this directly
   * rather than relying on one.
   */
  function sync() {
    const id = provider.value as ProviderId;
    const custom = id === "custom";
    $("#baseURL-field").hidden = !custom;
    $("#customModel-field").hidden = !custom;
    $("#tier-field").hidden = custom;
    hint.innerHTML = keyHint(id, apiKey.value, baseURL.value, undetected && !custom);
  }

  apiKey.addEventListener("input", () => {
    const key = apiKey.value.trim();
    const detected = detectProvider(key);
    // Never off Custom: several OpenAI-compatible vendors issue sk- keys.
    if (detected && provider.value !== "custom") provider.value = detected;
    undetected = key !== "" && detected === null;
    sync();
  });
  provider.addEventListener("change", () => {
    undetected = false;
    sync();
  });
  baseURL.addEventListener("input", sync);

  /*
   * This was a permission toggle until 2026-08-20 — it called
   * chrome.permissions.request() for optional host access. Dia never showed a
   * prompt and never fired permissions.onAdded, so the feature was simply dead
   * there with nothing to see. The detector is declared in the manifest now, so
   * this is an ordinary stored setting and works in any Chromium.
   *
   * Written immediately rather than on SAVE: a switch that needs a second,
   * separate confirmation to take effect reads as broken.
   */
  watchPages.addEventListener("change", () => {
    const on = watchPages.checked;
    void setSettings({ pulseOnDetect: on }).then(() => {
      // The content script reads this at document_idle, so a tab that is
      // already open has already made its decision.
      say(on ? "Watching. Reload any open tabs to arm them." : "No longer watching.", 6000);
    });
  });

  sync();
  void (async () => {
    const settings = await getSettings();
    apiKey.value = settings.apiKey;
    provider.value = settings.provider;
    tier.value = settings.tier;
    baseURL.value = settings.baseURL;
    customModel.value = settings.customModel;
    captureFrames.checked = settings.captureFrames;
    watchPages.checked = settings.pulseOnDetect;
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="units"][value="${settings.units}"]`,
    );
    if (radio) radio.checked = true;
    sync();
  })();

  // Submitting is wired for Enter-in-a-field; the SAVE button lives in the
  // shared action row, so it dispatches submit rather than duplicating this.
  // The form is novalidate: a hidden Custom field must never block Save, and
  // the message belongs in the status line, not a native bubble.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });

  async function save() {
    const id = provider.value as ProviderId;
    const base = normalizeBaseURL(baseURL.value);
    const model = customModel.value.trim();
    if (id === "custom" && (!httpHost(base) || !model)) {
      say("Custom needs a base URL and a model ID.");
      return;
    }
    const units = (new FormData(form).get("units") as Units | null) ?? "metric";
    await setSettings({
      apiKey: apiKey.value.trim(),
      provider: id,
      tier: tier.value as Tier,
      // Kept even when another provider is chosen, so switching back loses nothing.
      baseURL: base,
      customModel: model,
      units,
      captureFrames: captureFrames.checked,
    });
    baseURL.value = base;
    status.textContent = "Prepped.";
    setTimeout(() => (status.textContent = ""), 2000);
  }
}
```

`extension/scripts/port-design.mjs`, in the Prep block (`prepView`): change

```css
#prep-view .field input[type="password"],
#prep-view .field select {
```

to

```css
#prep-view .field input[type="password"],
#prep-view .field input[type="text"],
#prep-view .field input[type="url"],
#prep-view .field select {
```

and add after the `#prep-view .field { … }` rule:

```css
/* .field is display:grid, which outranks the user agent's [hidden] rule. The
   Custom fields hide with the attribute, so restate it. */
#prep-view [hidden] {
  display: none;
}
```

Then run `npm run port:design`.

- [ ] **Step 4: Run tests, type-check, port audit**

Run: `npm run test:ext && npx tsc --noEmit -p extension/tsconfig.json && npm run audit:ext > .scratch/audit-after.txt 2>&1; diff .scratch/audit-before.txt .scratch/audit-after.txt; git diff extension/src/popup/popup.css`
Expected: tests PASS, tsc clean, the audit diff is empty (the baseline was captured on `main` before Task 1, at `.scratch/audit-before.txt`), and the `popup.css` diff is exactly the two Prep rules.

- [ ] **Step 5: Commit**

```bash
git add extension/src/popup/views/prep.ts extension/scripts/port-design.mjs extension/src/popup/popup.css extension/tests/prep.test.ts
git commit -m "Prep: pick a provider, detect it from the key, configure a custom endpoint"
```

---

### Task 8: Live tests for every vendor

**Files:**
- Modify: `extension/tests/live/key.ts` (`liveKey(envVar)`)
- Create: `extension/tests/live/render-frame.ts` (moved out of `vision.live.ts`)
- Modify: `extension/tests/live/extract.live.ts`, `extension/tests/live/vision.live.ts`
- Create: `extension/tests/live/providers.live.ts`

**Interfaces:**
- Consumes: `extractRecipe`, `OffMenuError` (Task 5); `resolveConnection` (Task 4); `PRESETS`, `PresetId` (Task 1).

These make billed calls and are never run by `test:ext`. Only Anthropic can run here today.

- [ ] **Step 1: `liveKey(envVar)`** — in `extension/tests/live/key.ts` change the signature to `export function liveKey(envVar = "ANTHROPIC_API_KEY"): string | null`, read `process.env[envVar]`, build the env-file regex from `envVar` (`new RegExp(\`^\\s*${envVar}\\s*=\\s*(.+)$\`, "m")`), and keep the bare-`sk-ant-` file fallback only when `envVar === "ANTHROPIC_API_KEY"`. Update its doc comment.

- [ ] **Step 2: Move `renderFrame`** — cut `chromium` loading and `renderFrame` from `vision.live.ts` into `extension/tests/live/render-frame.ts`, exporting `chromium` (or `null`) and `renderFrame(body)`. Import both back into `vision.live.ts`.

- [ ] **Step 3: (done in Task 5)** The existing live files were ported to `extractRecipe({ connection })` there; only the `renderFrame` move above touches them now.

- [ ] **Step 4: Write `extension/tests/live/providers.live.ts`**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { extractRecipe, OffMenuError } from "../../src/lib/extract";
import { resolveConnection } from "../../src/lib/providers/connection";
import { PRESETS, type PresetId } from "../../src/lib/providers/presets";
import type { ExtractionPayload } from "../../src/lib/page-source";
import { liveKey } from "./key";
import { chromium, renderFrame } from "./render-frame";

/**
 * One pass per vendor, on the Fast tier: text, a declined page, and frames.
 * A vendor without a key in the environment is skipped, not failed. Until a
 * vendor's block has passed once, its preset is unverified (CLAUDE.md, Providers).
 *
 *   OPENAI_API_KEY=… GEMINI_API_KEY=… npm run test:live
 */

const ENV: Record<PresetId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const article = (text: string, source: string): ExtractionPayload => ({
  via: "article text", text, source, title: "", hasVideo: false,
});

const RECIPE = `Weeknight Gochujang Pork Belly. Serves 4.
Ingredients: 800 g pork belly, skin on; 3 tablespoons gochujang; 2 tablespoons honey;
1.5 tablespoons light soy sauce; 4 cloves garlic, crushed; 1 thumb ginger, julienned.
Method: Score the skin and salt it overnight. Sear skin down until it blisters.
Whisk gochujang, honey, soy, garlic and ginger with 100 ml water, pour around the pork,
cover and roast at 160 C for 90 minutes. Rest 10 minutes and slice.`;

const NOT_A_RECIPE = `Quarterly results. Revenue rose four percent year on year,
driven by subscriptions. Operating margin held at twelve percent. The board approved
a dividend of 0.30 per share, payable next month.`;

for (const id of Object.keys(PRESETS) as PresetId[]) {
  const key = liveKey(ENV[id]);
  const suite = key ? describe : describe.skip;

  suite(`live — ${PRESETS[id].label} (${PRESETS[id].models.fast})`, () => {
    const connection = () =>
      resolveConnection({ apiKey: key!, provider: id, tier: "fast", baseURL: "", customModel: "" });

    it("extracts a recipe from article text", async () => {
      const recipe = await extractRecipe(article(RECIPE, "https://example.com/pork"), {
        connection: connection(), units: "metric",
      });
      expect(recipe.title.toLowerCase()).toContain("pork");
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(5);
      expect(recipe.method.length).toBeGreaterThanOrEqual(3);
    }, 120_000);

    it("declines a page with no recipe", async () => {
      await expect(
        extractRecipe(article(NOT_A_RECIPE, "https://example.com/results"), {
          connection: connection(), units: "metric",
        }),
      ).rejects.toBeInstanceOf(OffMenuError);
    }, 120_000);

    (chromium ? it : it.skip)("reads a recipe from frames", async () => {
      const frames = [
        await renderFrame("MISO BUTTER MUSHROOM UDON\n\n400 g fresh udon\n300 g mixed mushrooms\n2 tbsp white miso\n40 g butter"),
        await renderFrame("1. Fry the mushrooms in butter until golden.\n2. Stir in the miso and a splash of pasta water.\n3. Toss through the udon."),
        await renderFrame("Finish with spring onion and chilli oil."),
      ];
      const recipe = await extractRecipe(
        { via: "caption only", text: "udon 🍜", source: "https://instagram.com/reel/TEST", title: "", hasVideo: true },
        { connection: connection(), units: "metric", frames },
      );
      expect(recipe.title.toLowerCase()).toContain("udon");
      expect(recipe.ingredients.map((i) => i.item.toLowerCase()).join(" ")).toMatch(/miso/);
    }, 180_000);
  });
}
```

- [ ] **Step 5: Type-check and run what can run**

Run: `npx tsc --noEmit -p extension/tsconfig.json && npm run test:ext`
Expected: clean, PASS. Then, only if an Anthropic key is present in the environment or `.env.local` (never create or write one): `npm run test:live`. Expected: Anthropic blocks pass; every other vendor reports skipped. Record which vendors passed for Task 9.

- [ ] **Step 6: Commit**

```bash
git add extension/tests/live
git commit -m "Live tests per vendor, skipped for any vendor without a key"
```

---

### Task 9: Docs, build and browser verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`** (in the worktree):
  - "Constraints": "BYOK: user's Anthropic key in `chrome.storage.local`" → "BYOK: the user's own key, from Anthropic, OpenAI, Gemini, Grok, Mistral, OpenRouter or any OpenAI-compatible server, in `chrome.storage.local`".
  - "The extension" intro: "the popup calls the Anthropic API directly" → "the popup calls the chosen provider's API directly".
  - Replace the whole "Deferred to launch — multi-provider keys" section with a "Providers" section: the two paths (Anthropic SDK; Chat Completions over `fetch`), the presets table (copy from the spec), key detection and its order, Custom (normalised URL, keyless allowed, http localhost expected, LAN unverified), the retry asymmetry, the 120 s timeout, and a **verified live** line listing exactly which presets passed `test:live` in Task 8 (expected: Anthropic only) — every other preset marked unverified.
  - The **Model** line: Fast/Thorough per provider; Anthropic Fast is `claude-haiku-4-5`, Thorough `claude-opus-5-5`; Haiku 4.5 does not accept `effort` or thinking.
  - "Failure states": kinds are classified in the adapters (`ProviderError`), copy names the vendor, "CLAUDE OVERLOADED" became "OVERLOADED" in product and specimen.
  - The `test:live` paragraph: one env var per vendor (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`); vendors without a key skip.
  - Test count in the command list: replace "234 tests" with the count `npm run test:ext` now reports.

- [ ] **Step 2: Build and smoke**

Run: `npm run build:ext && npm run smoke:ext && npm run build:embed -- --out .scratch/embed/mise && npx vitest run --root extension tests/build-embed.test.ts`
Expected: all succeed. Then prove the embed imports nothing under `lib/providers/`: `npx esbuild extension/src/embed/main.ts --bundle --metafile=.scratch/embed-meta.json --outfile=.scratch/embed-check.js && grep -c "lib/providers" .scratch/embed-meta.json` → `0`.

- [ ] **Step 3: Look at Prep in a real browser**

Load `extension/dist/popup/popup.html` in real Chromium at 400px wide (Playwright with the unpacked extension, as `smoke:ext` does, or the render harness pattern in `scripts/`). Open Prep and screenshot three states, and **Read each screenshot**:
1. default (no key): hint lists the vendors and links "Make one at Anthropic";
2. after typing a dummy `sk-proj-test` key: provider reads OpenAI, hint names `api.openai.com`;
3. Custom chosen: Base URL and Model ID visible, Model menu hidden.

In each, measure the action row: the last button's right edge must not pass the row's content box (`last.right - (row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)) <= 0`). Read the console for errors and warnings. Save the screenshots under `.scratch/prep/`.

- [ ] **Step 4: Full suite, type-check, audit**

Run: `npm run test:ext && npx tsc --noEmit -p extension/tsconfig.json && npx tsc --noEmit && npm run audit:ext`
Expected: PASS, clean (root tsconfig excludes `extension`, so the second tsc proves the Vercel build is unaffected), and `npm run audit:ext` output identical to `.scratch/audit-before.txt`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document providers, the error taxonomy and per-vendor live tests"
```
