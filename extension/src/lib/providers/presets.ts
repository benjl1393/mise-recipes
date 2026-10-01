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
