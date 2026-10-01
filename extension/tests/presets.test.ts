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
      "anthropic",
      "openai",
      "gemini",
      "xai",
      "mistral",
      "openrouter",
      "custom",
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
