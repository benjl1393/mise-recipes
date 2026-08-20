/**
 * Failure taxonomy for the Kitchen Error card.
 *
 * The specimen's error state carries a callout with a short shouted label, a
 * machine code, and one plain sentence telling the user what to do. That
 * only works if failures are classified — a raw SDK message ("400 Bad
 * Request") tells a home cook nothing actionable.
 */

export interface Classified {
  /** Shouted label, sits after the ▲ warning glyph. */
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

/** The SDK surfaces HTTP status on APIError; plain Errors have none. */
function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

export function classify(error: unknown): Classified {
  if (error instanceof NoKeyError) {
    return {
      label: "NO API KEY",
      code: "SETUP",
      body: "Mise needs your own Anthropic key. Open Prep, paste it in, and fire again.",
      canRetry: false,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  switch (statusOf(error)) {
    case 529:
      return {
        label: "CLAUDE OVERLOADED",
        code: "HTTP 529",
        body: "Claude's servers are busy right now. Retry in ~30s, or switch model in Prep.",
        canRetry: true,
      };
    case 429:
      return {
        label: "RATE LIMITED",
        code: "HTTP 429",
        body: "You've hit your API rate limit. Wait a moment, then retry.",
        canRetry: true,
      };
    case 401:
    case 403:
      return {
        label: "KEY REJECTED",
        code: "HTTP 401",
        body: "Anthropic refused that key. Check it in Prep — it may be revoked or mistyped.",
        canRetry: false,
      };
    case 400:
      return {
        label: "REQUEST REJECTED",
        code: "HTTP 400",
        body: `Claude rejected the request. ${message}`,
        canRetry: false,
      };
    case 500:
    case 502:
    case 503:
      return {
        label: "UPSTREAM ERROR",
        code: `HTTP ${statusOf(error)}`,
        body: "Anthropic had a server error. Retry in a moment.",
        canRetry: true,
      };
  }

  // No status: a fetch rejection, a CORS block, or our own parse failure.
  if (/failed to fetch|network|load failed|cors/i.test(message)) {
    return {
      label: "NETWORK DROP",
      code: "OFFLINE",
      body: "Couldn't reach api.anthropic.com. Check your connection, then retry.",
      canRetry: true,
    };
  }
  if (/parse|json|schema|unexpected/i.test(message)) {
    return {
      label: "PARSE FAILURE",
      code: "BAD SHAPE",
      body: "Claude's reply didn't match the recipe shape. Retrying usually fixes it.",
      canRetry: true,
    };
  }
  if (/could not read this page|receiving end/i.test(message)) {
    return {
      label: "PAGE UNREADABLE",
      code: "NO ACCESS",
      body: "Mise can't read this page. Reload it, or select the recipe text and right-click → Fire.",
      canRetry: true,
    };
  }

  return {
    label: "EXTRACTION FAILED",
    code: "ERROR",
    body: message,
    canRetry: true,
  };
}
