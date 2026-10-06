import { describe, it, expect } from "vitest";
import {
  buildPrompt,
  RECIPE_SCHEMA,
  sampleFrames,
  toNullableSchema,
  validateOutput,
  type JsonSchema,
} from "../src/lib/extract";
import { ProviderError, type ErrorContext } from "../src/lib/providers/errors";
import type { ExtractionPayload } from "../src/lib/page-source";

const payload: ExtractionPayload = {
  via: "article text",
  text: "Gochujang pork belly. 800g pork belly. Roast 90 minutes.",
  source: "https://example.com/pork",
  title: "Gochujang Pork Belly",
  hasVideo: false,
};

const ctx: ErrorContext = {
  label: "OpenAI",
  host: "api.openai.com",
  model: "gpt-6-luna",
  custom: false,
  url: "https://api.openai.com/v1/chat/completions",
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
    found: true,
    title: "T",
    subtitle: null,
    author: null,
    serves: "2",
    hands_on: null,
    total: "1h",
    ingredients: [{ qty: "1", item: "x" }],
    method: ["y"],
    notes: null,
    tags: ["pork"],
  };

  it("turns nulls into absent fields", () => {
    const r = validateOutput(good, ctx);
    expect(r.subtitle).toBeUndefined();
    expect(r.notes).toBeUndefined();
    expect(r.total).toBe("1h");
  });

  it("accepts found:false with empty fields", () => {
    const declined = { found: false, title: "", serves: "", ingredients: [], method: [], tags: [] };
    expect(validateOutput(declined, ctx).found).toBe(false);
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
