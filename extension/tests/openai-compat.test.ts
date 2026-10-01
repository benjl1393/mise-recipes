import { describe, it, expect, vi } from "vitest";
import { callOpenAICompat, buildBody } from "../src/lib/providers/openai-compat";
import { resolveConnection, type ModelRequest } from "../src/lib/providers/connection";
import { ProviderError } from "../src/lib/providers/errors";

type Preset = "openai" | "mistral" | "openrouter" | "gemini";

const conn = (provider: Preset = "openai", apiKey = "sk-proj-x") =>
  resolveConnection({ apiKey, provider, tier: "fast", baseURL: "", customModel: "" });
const custom = (apiKey = "") =>
  resolveConnection({
    apiKey,
    provider: "custom",
    tier: "fast",
    baseURL: "http://localhost:11434/v1",
    customModel: "llama3.3",
  });

const req = (frames: string[] = []): ModelRequest => ({
  prompt: "Extract.",
  frames,
  schema: { type: "object" },
  maxTokens: 8000,
});

const ok = (content: unknown) =>
  new Response(
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }),
    { status: 200 },
  );

async function kindOf(p: Promise<unknown>) {
  try {
    await p;
    return "resolved";
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError);
    return (e as ProviderError).kind;
  }
}

type Message = { content: unknown };
type Part = { type: string; image_url?: { url: string } };

describe("buildBody", () => {
  it("sends a plain string when there are no frames", () => {
    const body = buildBody(conn(), req());
    expect((body.messages as Message[])[0]!.content).toBe("Extract.");
  });

  it("puts image parts before the text, as data URLs", () => {
    const body = buildBody(conn(), req(["AAA", "BBB"]));
    const parts = (body.messages as Message[])[0]!.content as Part[];
    expect(parts.map((p) => p.type)).toEqual(["image_url", "image_url", "text"]);
    expect(parts[0]!.image_url!.url).toBe("data:image/jpeg;base64,AAA");
  });

  it("uses each preset's token parameter, strictness and extra body", () => {
    const schemaOf = (b: Record<string, unknown>) =>
      (b.response_format as { json_schema: Record<string, unknown> }).json_schema;

    const openai = buildBody(conn("openai"), req());
    expect(openai).toMatchObject({ max_completion_tokens: 8000, reasoning_effort: "low" });
    expect(openai).not.toHaveProperty("max_tokens");
    expect(schemaOf(openai).strict).toBe(true);

    const mistral = buildBody(conn("mistral"), req());
    expect(mistral).toMatchObject({ max_tokens: 8000 });
    expect(schemaOf(mistral)).not.toHaveProperty("strict");

    expect(buildBody(conn("openrouter"), req())).toMatchObject({
      provider: { require_parameters: true },
    });
  });
});

describe("callOpenAICompat", () => {
  it("POSTs to {base}/chat/completions with a bearer key and returns the parsed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('{"found":false}'));
    expect(await callOpenAICompat(conn(), req(), fetchImpl)).toEqual({ found: false });
    const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk-proj-x");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends no Authorization header for a keyless local server", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('{"found":false}'));
    await callOpenAICompat(custom(), req(), fetchImpl);
    const init = fetchImpl.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("strips a markdown code fence some local models wrap JSON in", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('```json\n{"found":false}\n```'));
    expect(await callOpenAICompat(custom(), req(), fetchImpl)).toEqual({ found: false });
  });

  it("classifies a non-2xx by status and body", async () => {
    const body = { error: { message: "Incorrect API key provided", code: "invalid_api_key" } };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 401 }));
    expect(await kindOf(callOpenAICompat(conn(), req(), fetchImpl))).toBe("auth");
  });

  it("treats an error inside a 200 as a failure (OpenRouter does this)", async () => {
    const body = { error: { code: 502, message: "Upstream error" } };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    expect(await kindOf(callOpenAICompat(conn("openrouter", "sk-or-x"), req(), fetchImpl))).toBe(
      "server",
    );
  });

  it("reads finish_reason length as truncated", async () => {
    const body = { choices: [{ finish_reason: "length", message: { content: '{"fo' } }] };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    expect(await kindOf(callOpenAICompat(conn(), req(), fetchImpl))).toBe("truncated");
  });

  it("reads a refusal as malformed, keeping the refusal", async () => {
    const body = {
      choices: [
        { finish_reason: "stop", message: { content: null, refusal: "I can't help with that." } },
      ],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    try {
      await callOpenAICompat(conn(), req(), fetchImpl);
      expect.unreachable();
    } catch (e) {
      expect((e as ProviderError).kind).toBe("malformed");
      expect((e as ProviderError).detail).toMatch(/can't help/);
    }
  });

  it("reads content that is not JSON as malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("Here is your recipe!"));
    expect(await kindOf(callOpenAICompat(conn(), req(), fetchImpl))).toBe("malformed");
  });

  // AbortSignal.timeout also aborts body consumption, and a socket can drop
  // after the headers arrive: both reject response.text(), not fetch().
  it("maps a failure while reading the body like a failure to connect", async () => {
    const bodyFails = (error: unknown) =>
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.reject(error) });
    const timedOut = bodyFails(new DOMException("signal timed out", "TimeoutError"));
    expect(await kindOf(callOpenAICompat(custom(), req(), timedOut))).toBe("timeout");
    const dropped = bodyFails(new TypeError("network error"));
    expect(await kindOf(callOpenAICompat(custom(), req(), dropped))).toBe("network");
  });

  it("reads a timeout as timeout, and any other fetch rejection as network", async () => {
    const timeout = vi.fn().mockRejectedValue(new DOMException("signal timed out", "TimeoutError"));
    expect(await kindOf(callOpenAICompat(custom(), req(), timeout))).toBe("timeout");
    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await kindOf(callOpenAICompat(custom(), req(), offline))).toBe("network");
  });
});
