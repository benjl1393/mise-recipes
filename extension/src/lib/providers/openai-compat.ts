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
  let text: string;
  try {
    response = await fetchImpl(endpointOf(conn), {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody(conn, req)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Inside the same try: the timeout signal also aborts reading the body,
    // and a socket can drop after the headers arrive.
    text = await response.text();
  } catch (error) {
    const { name, message } = error as { name?: string; message?: string };
    throw new ProviderError(name === "TimeoutError" ? "timeout" : "network", ctx, {
      detail: message ?? String(error),
    });
  }

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

  const choice = (
    body as
      | {
          choices?: Array<{
            finish_reason?: string;
            message?: { content?: unknown; refusal?: unknown };
          }>;
        }
      | undefined
  )?.choices?.[0];

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
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = parseJson(unfenced);
  if (parsed === undefined) {
    throw new ProviderError("malformed", ctx, { detail: "reply is not JSON" });
  }
  return parsed;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
