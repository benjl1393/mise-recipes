/**
 * Failure taxonomy for the Kitchen Error card.
 *
 * The specimen's error state carries a callout with a short shouted label, a
 * machine code, and one plain sentence telling the user what to do. That
 * only works if failures are classified — a raw SDK message ("400 Bad
 * Request") tells a home cook nothing actionable.
 */

import { ProviderError } from "../lib/providers/errors";

export interface Classified {
  /** Shouted label, sits after the alert icon. */
  label: string;
  /** Machine-readable code in the callout's right slot. */
  code: string;
  /** One sentence: what happened, and what to do about it. */
  body: string;
  /** Whether re-running the same extraction could plausibly succeed. */
  canRetry: boolean;
}

/** Thrown when the popup has no key yet — a setup state, not a failure. */
export class NoKeyError extends Error {
  constructor() {
    super("No API key yet. Open Prep to add one.");
    this.name = "NoKeyError";
  }
}

export function classify(error: unknown): Classified {
  if (error instanceof NoKeyError) {
    return {
      label: "NO API KEY",
      code: "SETUP",
      body: "Mise needs an API key from your AI provider. Open Prep, paste it in, and fire again.",
      canRetry: false,
    };
  }

  if (error instanceof ProviderError) return fromProvider(error);

  const message = error instanceof Error ? error.message : String(error);

  if (/could not read this page|receiving end/i.test(message)) {
    return {
      label: "PAGE UNREADABLE",
      code: "NO ACCESS",
      body: "Mise can't read this page. Reload it, or select the recipe text and right-click → Fire.",
      canRetry: true,
    };
  }

  return { label: "EXTRACTION FAILED", code: "ERROR", body: message, canRetry: true };
}

/**
 * Labels stay short and vendor-free — they are shouted in a narrow callout.
 * Bodies name the vendor, because "refused that key" means nothing until you
 * know who refused it. The adapters have already classified the failure, so
 * nothing here looks at a raw status.
 */
function fromProvider(e: ProviderError): Classified {
  const swap = e.custom ? "try another model in Prep" : "switch between Fast and Thorough in Prep";
  const http = `HTTP ${e.status ?? ""}`.trim();

  switch (e.kind) {
    case "auth":
      return {
        label: "KEY REJECTED",
        code: http,
        body: `${e.label} refused that key. Check it in Prep: it may be revoked, mistyped, or for a different provider.`,
        canRetry: false,
      };
    case "billing":
      return {
        label: "OUT OF CREDIT",
        code: http,
        body: `${e.label} says this account is out of credit. Top it up, then retry.`,
        canRetry: true,
      };
    case "rate":
      return {
        label: "RATE LIMITED",
        code: "HTTP 429",
        body: `You've hit your ${e.label} rate limit. Wait a moment, then retry.`,
        canRetry: true,
      };
    case "overloaded":
      return {
        label: "OVERLOADED",
        code: http,
        body: `${e.label}'s servers are busy. Retry in about 30 seconds, or ${swap}.`,
        canRetry: true,
      };
    case "rejected":
      if (e.status === 404) {
        return {
          label: "REQUEST REJECTED",
          code: "HTTP 404",
          // A Custom 404 is nearly always the URL (missing /v1), not the model.
          body: e.custom
            ? `Nothing answered at ${e.url}. Check the base URL in Prep; it usually ends in /v1.`
            : `${e.label} doesn't serve the model ${e.model}. Check Prep.`,
          canRetry: false,
        };
      }
      return {
        label: "REQUEST REJECTED",
        code: http,
        body: `${e.label} rejected the request. ${e.detail}`.trim(),
        canRetry: false,
      };
    case "server":
      return {
        label: "UPSTREAM ERROR",
        code: http,
        body: `${e.label} had a server error. Retry in a moment.`,
        canRetry: true,
      };
    case "network":
      return {
        label: "NETWORK DROP",
        code: "OFFLINE",
        body: `Couldn't reach ${e.host}. Check your connection, then retry.`,
        canRetry: true,
      };
    case "timeout":
      return {
        label: "TIMED OUT",
        code: "TIMEOUT",
        body: `${e.label} didn't answer within 2 minutes. Retry, or ${swap}.`,
        canRetry: true,
      };
    case "truncated":
      return {
        label: "REPLY CUT OFF",
        code: "LENGTH",
        body: `${e.label} ran out of room before the recipe was finished. Retrying won't help; ${swap}.`,
        canRetry: false,
      };
    case "malformed":
      return {
        label: "PARSE FAILURE",
        code: "BAD SHAPE",
        body: `${e.label}'s reply didn't match the recipe shape. Retrying usually fixes it, or ${swap}.`,
        canRetry: true,
      };
  }
}
