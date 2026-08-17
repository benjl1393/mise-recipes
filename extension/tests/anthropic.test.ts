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
      messages: { parse: vi.fn().mockResolvedValue({ parsed_output: parsed }) },
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
    // deduped, kebab-cased, and #weeknight computed from hands_on: 25m
    expect(recipe.tags).toEqual(["#pork", "#slow-cooker", "#weeknight"]);
  });

  it("throws OffMenuError when the model reports no recipe", async () => {
    const client = clientReturning({
      found: false,
      title: "",
      serves: "",
      ingredients: [],
      method: [],
      tags: [],
    });
    await expect(
      extractRecipe(payload, { client, units: "metric", model: "m" }),
    ).rejects.toBeInstanceOf(OffMenuError);
  });

  it("throws OffMenuError when the recipe has no ingredients", async () => {
    const client = clientReturning({
      found: true,
      title: "Nothing",
      serves: "1",
      ingredients: [],
      method: ["x"],
      tags: [],
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

  it("sends frames as image blocks ahead of the text block", async () => {
    const client = clientReturning({
      found: true,
      title: "T",
      serves: "2",
      ingredients: [{ qty: "1", item: "x" }],
      method: ["y"],
      tags: ["#pork"],
    });
    await extractRecipe(
      { ...payload, via: "2 video frames" },
      { client, units: "metric", model: "m", frames: ["AAA", "BBB"] },
    );
    const parse = (client as never as { messages: { parse: ReturnType<typeof vi.fn> } })
      .messages.parse;
    const args = parse.mock.calls[0]![0] as {
      messages: Array<{ content: Array<{ type: string }> }>;
    };
    const blocks = args.messages[0]!.content;
    expect(blocks.filter((b) => b.type === "image")).toHaveLength(2);
    expect(blocks.at(-1)!.type).toBe("text");
  });

  it("does not send effort or thinking — unsupported on Haiku 4.5", async () => {
    const client = clientReturning({
      found: true,
      title: "T",
      serves: "2",
      ingredients: [{ qty: "1", item: "x" }],
      method: ["y"],
      tags: ["#pork"],
    });
    await extractRecipe(payload, { client, units: "metric", model: "claude-haiku-4-5" });
    const parse = (client as never as { messages: { parse: ReturnType<typeof vi.fn> } })
      .messages.parse;
    const args = parse.mock.calls[0]![0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("thinking");
    expect(args).not.toHaveProperty("output_config.effort");
    expect((args.output_config as Record<string, unknown>).effort).toBeUndefined();
  });
});
