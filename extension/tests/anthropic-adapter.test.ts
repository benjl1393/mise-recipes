import { describe, it, expect, vi } from "vitest";
import {
  AnthropicError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "@anthropic-ai/sdk";
import { callAnthropic, type AnthropicLike } from "../src/lib/providers/anthropic";
import { resolveConnection } from "../src/lib/providers/connection";
import { ProviderError } from "../src/lib/providers/errors";

const conn = resolveConnection({
  apiKey: "sk-ant-x",
  provider: "anthropic",
  tier: "fast",
  baseURL: "",
  customModel: "",
});
const req = { prompt: "Extract.", frames: ["AAA"], schema: { type: "object" }, maxTokens: 8000 };

const client = (impl: () => Promise<unknown>): AnthropicLike => ({
  messages: { parse: vi.fn(impl) },
});

async function kindOf(p: Promise<unknown>) {
  try {
    await p;
    return "resolved";
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError);
    return (e as ProviderError).kind;
  }
}

const apiError = (status: number, type: string, message: string) =>
  new APIError(status, { type: "error", error: { type, message } }, message, new Headers());

describe("callAnthropic", () => {
  it("returns parsed_output and sends images before the text", async () => {
    const c = client(async () => ({ parsed_output: { found: false }, stop_reason: "end_turn" }));
    expect(await callAnthropic(conn, req, c)).toEqual({ found: false });
    const body = (c.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      model: string;
      messages: Array<{ content: Array<{ type: string }> }>;
    };
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.messages[0]!.content.map((b) => b.type)).toEqual(["image", "text"]);
    expect(body).not.toHaveProperty("thinking");
  });

  it.each([
    ["a connection timeout", () => new APIConnectionTimeoutError(), "timeout"],
    ["a dropped connection", () => new APIConnectionError({ message: undefined }), "network"],
    [
      "a structured-output parse failure",
      () => new AnthropicError("Failed to parse structured output: bad"),
      "malformed",
    ],
    ["a 529", () => apiError(529, "overloaded_error", "Overloaded"), "overloaded"],
    ["a 401", () => apiError(401, "authentication_error", "invalid x-api-key"), "auth"],
  ])("maps %s", async (_, make, kind) => {
    const failing = client(async () => {
      throw make();
    });
    expect(await kindOf(callAnthropic(conn, req, failing))).toBe(kind);
  });

  it("reads stop_reason max_tokens as truncated", async () => {
    const c = client(async () => ({ parsed_output: null, stop_reason: "max_tokens" }));
    expect(await kindOf(callAnthropic(conn, req, c))).toBe("truncated");
  });

  it("reads a null parsed_output as malformed", async () => {
    const c = client(async () => ({ parsed_output: null, stop_reason: "end_turn" }));
    expect(await kindOf(callAnthropic(conn, req, c))).toBe("malformed");
  });
});
