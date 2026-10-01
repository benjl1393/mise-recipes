import { describe, it, expect } from "vitest";
import {
  contextOf,
  endpointOf,
  resolveConnection,
  type ConnectionSettings,
} from "../src/lib/providers/connection";
import { PRESETS, type PresetId } from "../src/lib/providers/presets";

const base: ConnectionSettings = {
  apiKey: "k",
  provider: "anthropic",
  tier: "fast",
  baseURL: "",
  customModel: "",
};

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
      ...base,
      provider: "custom",
      apiKey: "",
      baseURL: "http://localhost:11434/v1/chat/completions",
      customModel: " llama3.3 ",
    });
    expect(c).toMatchObject({
      provider: "custom",
      label: "Your provider",
      host: "localhost:11434",
      protocol: "openai",
      baseURL: "http://localhost:11434/v1",
      model: "llama3.3",
      apiKey: "",
      strict: false,
      tokenParam: "max_tokens",
    });
    expect(endpointOf(c)).toBe("http://localhost:11434/v1/chat/completions");
    expect(contextOf(c).custom).toBe(true);
  });

  it("refuses a Custom provider with no URL or no model", () => {
    expect(() => resolveConnection({ ...base, provider: "custom", customModel: "m" })).toThrow(
      /base URL/,
    );
    expect(() =>
      resolveConnection({ ...base, provider: "custom", baseURL: "https://x.test/v1" }),
    ).toThrow(/model ID/);
    expect(() =>
      resolveConnection({ ...base, provider: "custom", baseURL: "ftp://x.test", customModel: "m" }),
    ).toThrow();
  });

  it("names Anthropic's endpoint for the error card", () => {
    expect(endpointOf(resolveConnection(base))).toBe("https://api.anthropic.com/v1/messages");
  });

  it("copies extraBody so a caller cannot mutate the preset", () => {
    const c = resolveConnection({ ...base, provider: "openrouter" });
    c.extraBody.x = 1;
    expect(PRESETS.openrouter.extraBody).not.toHaveProperty("x");
  });
});
