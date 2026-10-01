import { describe, it, expect, vi } from "vitest";
import { extractRecipe, OffMenuError } from "../src/lib/extract";
import { resolveConnection } from "../src/lib/providers/connection";
import type { ExtractionPayload } from "../src/lib/page-source";

const payload: ExtractionPayload = {
  via: "article text",
  text: "Gochujang pork belly. 800g pork belly. Roast 90 minutes.",
  source: "https://example.com/pork",
  title: "Gochujang Pork Belly",
  hasVideo: false,
};

const connection = resolveConnection({
  apiKey: "k",
  provider: "anthropic",
  tier: "fast",
  baseURL: "",
  customModel: "",
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
    const recipe = await extractRecipe(payload, { connection, units: "metric", transport: { anthropic: client } });
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
      extractRecipe(payload, { connection, units: "metric", transport: { anthropic: client } }),
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
      extractRecipe(payload, { connection, units: "metric", transport: { anthropic: client } }),
    ).rejects.toBeInstanceOf(OffMenuError);
  });

  it("throws malformed when structured output is missing", async () => {
    const client = clientReturning(null);
    await expect(
      extractRecipe(payload, { connection, units: "metric", transport: { anthropic: client } }),
    ).rejects.toMatchObject({ name: "ProviderError", kind: "malformed" });
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
      { connection, units: "metric", frames: ["AAA", "BBB"], transport: { anthropic: client } },
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
    await extractRecipe(payload, { connection, units: "metric", transport: { anthropic: client } });
    const parse = (client as never as { messages: { parse: ReturnType<typeof vi.fn> } })
      .messages.parse;
    const args = parse.mock.calls[0]![0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("thinking");
    expect(args).not.toHaveProperty("output_config.effort");
    expect((args.output_config as Record<string, unknown>).effort).toBeUndefined();
  });

  it("goes through Chat Completions with the nullable schema for a non-Anthropic provider", async () => {
    const openai = resolveConnection({
      apiKey: "sk-proj-x",
      provider: "openai",
      tier: "fast",
      baseURL: "",
      customModel: "",
    });
    const content = JSON.stringify({
      found: true,
      title: "T",
      subtitle: null,
      author: null,
      serves: "2",
      hands_on: "25m",
      total: null,
      ingredients: [{ qty: "1", item: "x" }],
      method: ["y"],
      notes: null,
      tags: ["Pork"],
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), {
        status: 200,
      }),
    );
    const recipe = await extractRecipe(payload, {
      connection: openai,
      units: "metric",
      transport: { fetch: fetchImpl },
    });
    expect(recipe.subtitle).toBeUndefined();
    expect(recipe.tags).toEqual(["#pork", "#weeknight"]);
    const sent = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(sent.response_format.json_schema.schema.required).toContain("subtitle");
  });

  it("samples frames down to the connection's cap", async () => {
    const mistral = resolveConnection({
      apiKey: "m",
      provider: "mistral",
      tier: "fast",
      baseURL: "",
      customModel: "",
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"found":false}' } }] }),
        { status: 200 },
      ),
    );
    await expect(
      extractRecipe(payload, {
        connection: mistral,
        units: "metric",
        frames: Array(24).fill("AAA"),
        transport: { fetch: fetchImpl },
      }),
    ).rejects.toBeInstanceOf(OffMenuError);
    const sent = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    const images = sent.messages[0].content.filter((p: { type: string }) => p.type === "image_url");
    expect(images).toHaveLength(8);
  });
});
