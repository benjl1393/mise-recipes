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
    // The SDK's default is 10 minutes per attempt; the TIMED OUT card promises
    // 2, the same limit the fetch path uses.
    timeout: 120_000,
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
