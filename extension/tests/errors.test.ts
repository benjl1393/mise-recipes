// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { classify, NoKeyError } from "../src/popup/errors";
import { errorFallbacks } from "../src/popup/actions";
import { renderError } from "../src/popup/render";

/** Mimics the SDK's APIError, which carries an HTTP status. */
function apiError(status: number, message = "boom") {
  return Object.assign(new Error(message), { status });
}

const parse = (html: string) => {
  const host = document.createElement("div");
  host.className = "popup";
  host.innerHTML = html;
  return host;
};

describe("classify", () => {
  it("names an overloaded upstream and allows retry", () => {
    const c = classify(apiError(529));
    expect(c.label).toBe("CLAUDE OVERLOADED");
    expect(c.code).toBe("HTTP 529");
    expect(c.canRetry).toBe(true);
  });

  it("treats a rejected key as unretryable — retrying cannot help", () => {
    const c = classify(apiError(401));
    expect(c.label).toBe("KEY REJECTED");
    expect(c.canRetry).toBe(false);
  });

  it("maps 403 onto the same rejected-key advice", () => {
    expect(classify(apiError(403)).label).toBe("KEY REJECTED");
  });

  it("keeps the upstream detail on a 400, since the cause is specific", () => {
    const c = classify(apiError(400, "effort is not supported"));
    expect(c.code).toBe("HTTP 400");
    expect(c.body).toContain("effort is not supported");
    expect(c.canRetry).toBe(false);
  });

  it("rate limiting is retryable", () => {
    const c = classify(apiError(429));
    expect(c.label).toBe("RATE LIMITED");
    expect(c.canRetry).toBe(true);
  });

  it("groups 5xx as a retryable upstream error", () => {
    expect(classify(apiError(503)).label).toBe("UPSTREAM ERROR");
    expect(classify(apiError(503)).code).toBe("HTTP 503");
    expect(classify(apiError(500)).canRetry).toBe(true);
  });

  // A statusless fetch rejection is what a CORS block looks like from script,
  // and it is the most likely first-run failure for a browser-origin call.
  it("reads a statusless fetch failure as a network drop", () => {
    const c = classify(new Error("Failed to fetch"));
    expect(c.label).toBe("NETWORK DROP");
    expect(c.code).toBe("OFFLINE");
    expect(c.canRetry).toBe(true);
  });

  it("recognises a schema mismatch as a parse failure", () => {
    expect(classify(new Error("Unexpected token in JSON")).label).toBe("PARSE FAILURE");
  });

  it("recognises an unreachable content script", () => {
    const c = classify(new Error("Could not read this page."));
    expect(c.label).toBe("PAGE UNREADABLE");
  });

  it("treats a missing key as setup, not failure, and offers no retry", () => {
    const c = classify(new NoKeyError());
    expect(c.label).toBe("NO API KEY");
    expect(c.code).toBe("SETUP");
    expect(c.canRetry).toBe(false);
  });

  it("falls back to the raw message rather than swallowing it", () => {
    const c = classify(new Error("something very specific broke"));
    expect(c.label).toBe("EXTRACTION FAILED");
    expect(c.body).toBe("something very specific broke");
  });

  it("handles a thrown non-Error without crashing", () => {
    expect(classify("plain string").body).toBe("plain string");
  });
});

describe("renderError", () => {
  const failure = { label: "CLAUDE OVERLOADED", code: "HTTP 529", body: "Servers are busy." };

  it("keeps the Kitchen Error stamp and marks the callout as an alert", () => {
    const doc = parse(renderError(failure));
    expect(doc.querySelector(".stamp.err h2.stamp-title")!.textContent).toBe("Kitchen Error");
    expect(doc.querySelector(".callout.error")!.getAttribute("role")).toBe("alert");
  });

  it("shouts the label behind a Tabler alert icon and shows the code", () => {
    const doc = parse(renderError(failure));
    const hdr = doc.querySelector(".callout .hdr")!;
    // An icon, never a text glyph (design-anti-ai-defaults: "a glyph is not an icon").
    expect(hdr.querySelector('svg[data-icon="alert-triangle"]')).not.toBeNull();
    expect(hdr.textContent).not.toContain("▲");
    expect(hdr.textContent).toContain("CLAUDE OVERLOADED");
    expect(doc.querySelector(".callout .hdr .code")!.textContent).toBe("HTTP 529");
    expect(doc.querySelector(".callout .body")!.textContent).toBe("Servers are busy.");
  });

  it("omits the fallback list entirely when there are no fallbacks", () => {
    expect(parse(renderError(failure)).querySelector(".fallback-list")).toBeNull();
  });

  it("renders each fallback with the icon of the button it names, and its key", () => {
    const doc = parse(renderError(failure, { fallbacks: errorFallbacks(true) }));
    const items = [...doc.querySelectorAll(".fallback-list li")];
    expect(items.length).toBe(2);
    // Retry wears RETRY's icon, Open Prep wears Prep's — and no text glyph remains.
    expect(items[0]!.querySelector('.gl svg[data-icon="refresh"]')).not.toBeNull();
    expect(items[1]!.querySelector('.gl svg[data-icon="settings"]')).not.toBeNull();
    for (const li of items) expect(li.querySelector(".gl")!.textContent!.trim()).toBe("");
    expect(items[0]!.querySelector(".kbd")!.textContent).toBe("↵");
    expect(items[1]!.textContent).toContain("Open Prep to change key or model");
    expect(items[1]!.querySelector(".kbd")!.textContent).toBe("P");
  });

  it("offers Retry as a fallback only when the failure is retryable", () => {
    expect(errorFallbacks(false).map((f) => f.key)).toEqual(["P"]);
    expect(errorFallbacks(true).map((f) => f.key)).toEqual(["↵", "P"]);
  });

  it("escapes an upstream message rather than injecting it as markup", () => {
    const doc = parse(
      renderError({ label: "X", code: "Y", body: "<img src=x onerror=alert(1)>" }),
    );
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelector(".callout .body")!.textContent).toContain("<img");
  });

  it("shows the page url and a failed source badge", () => {
    const doc = parse(renderError(failure, { url: "https://www.example.com/pork" }));
    expect(doc.querySelector(".url")!.textContent).toBe("example.com/pork");
    expect(doc.querySelector(".badge.pending")!.textContent).toBe("failed");
  });
});
