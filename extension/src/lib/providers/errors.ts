/**
 * One error type for every vendor, so the error card maps a *kind* to copy
 * and never has to know that Gemini answers a bad key with HTTP 400 while
 * OpenAI uses 401. Each adapter classifies; popup/errors.ts only words it.
 */

export type ProviderErrorKind =
  | "auth"
  | "billing"
  | "rate"
  | "overloaded"
  | "rejected"
  | "server"
  | "network"
  | "timeout"
  | "truncated"
  | "malformed";

/** Who was being called, so the error card can name them. */
export interface ErrorContext {
  label: string;
  host: string;
  model: string;
  /** A Custom endpoint: no Fast/Thorough menu, and a 404 usually means a wrong URL. */
  custom: boolean;
  /** The full endpoint that was called. */
  url: string;
}

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status: number | null;
  readonly detail: string;
  readonly label: string;
  readonly host: string;
  readonly model: string;
  readonly custom: boolean;
  readonly url: string;

  constructor(
    kind: ProviderErrorKind,
    ctx: ErrorContext,
    { status = null, detail = "" }: { status?: number | null; detail?: string } = {},
  ) {
    super(`${ctx.label} ${kind}${status ? ` (HTTP ${status})` : ""}${detail ? `: ${detail}` : ""}`);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
    this.label = ctx.label;
    this.host = ctx.host;
    this.model = ctx.model;
    this.custom = ctx.custom;
    this.url = ctx.url;
  }
}

const clip = (text: string) => text.slice(0, 200);

/**
 * One message out of any vendor's error body:
 *   { error: { message, code, type } }     OpenAI, OpenRouter, Anthropic
 *   [{ error: { message, code, status } }] Gemini
 *   { code, error: "…" }                   xAI
 *   { detail: "…" | [...] }                Mistral
 */
export function readErrorBody(body: unknown): { message: string; code: string | number | null } {
  if (typeof body === "string") return { message: clip(body), code: null };
  const first: unknown = Array.isArray(body) ? body[0] : body;
  if (first && typeof first === "object") {
    const o = first as Record<string, unknown>;
    if (o.error && typeof o.error === "object") {
      const e = o.error as Record<string, unknown>;
      const code = (e.code ?? e.type ?? e.status ?? null) as string | number | null;
      return { message: clip(String(e.message ?? "")), code };
    }
    if (typeof o.error === "string") {
      return { message: clip(o.error), code: (o.code ?? null) as string | number | null };
    }
    if (typeof o.detail === "string") return { message: clip(o.detail), code: null };
    if (o.detail !== undefined) return { message: clip(JSON.stringify(o.detail)), code: null };
    if (typeof o.message === "string") {
      return { message: clip(o.message), code: (o.code ?? null) as string | number | null };
    }
  }
  return { message: clip(JSON.stringify(body) ?? ""), code: null };
}

/**
 * First match wins. `invalid.*key` is deliberately not an auth pattern:
 * OpenAI's strict-schema 400 ("…every key in properties…") would match it.
 */
export function classifyResponse(
  status: number,
  body: unknown,
): { kind: ProviderErrorKind; detail: string } {
  const { message, code } = readErrorBody(body);
  const kind: ProviderErrorKind =
    status === 401 || status === 403
      ? "auth"
      : status === 402 ||
          code === "insufficient_quota" ||
          (status === 400 && /credit balance|billing/i.test(message))
        ? "billing"
        : status === 400 && /api[ _-]?key/i.test(message)
          ? "auth" // Gemini and xAI answer a bad key with 400
          : status === 429
            ? "rate" // Gemini's per-minute 429 mentions quota and billing; still a rate limit
            : status === 503 || status === 529
              ? "overloaded"
              : status >= 500
                ? "server"
                : "rejected";
  return { kind, detail: message };
}
