// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { classify, NoKeyError } from "../src/popup/errors";
import { errorFallbacks } from "../src/popup/actions";
import { renderError } from "../src/popup/render";
import {
  ProviderError,
  type ErrorContext,
  type ProviderErrorKind,
} from "../src/lib/providers/errors";

const parse = (html: string) => {
  const host = document.createElement("div");
  host.className = "popup";
  host.innerHTML = html;
  return host;
};

const preset: ErrorContext = {
  label: "OpenAI",
  host: "api.openai.com",
  model: "gpt-6-luna",
  custom: false,
  url: "https://api.openai.com/v1/chat/completions",
};
const custom: ErrorContext = {
  label: "Your provider",
  host: "localhost:11434",
  model: "llama3.3",
  custom: true,
  url: "http://localhost:11434/v1/chat/completions",
};
const err = (kind: ProviderErrorKind, status: number | null = null, ctx = preset, detail = "") =>
  new ProviderError(kind, ctx, { status, detail });

describe("classify", () => {
  it.each([
    ["auth", 401, "KEY REJECTED", false],
    ["billing", 402, "OUT OF CREDIT", true],
    ["rate", 429, "RATE LIMITED", true],
    ["overloaded", 529, "OVERLOADED", true],
    ["rejected", 400, "REQUEST REJECTED", false],
    ["server", 500, "UPSTREAM ERROR", true],
    ["network", null, "NETWORK DROP", true],
    ["timeout", null, "TIMED OUT", true],
    ["truncated", null, "REPLY CUT OFF", false],
    ["malformed", null, "PARSE FAILURE", true],
  ] as const)("%s → %s", (kind, status, label, canRetry) => {
    const c = classify(err(kind, status));
    expect(c.label).toBe(label);
    expect(c.canRetry).toBe(canRetry);
  });

  it("names the vendor in every provider failure", () => {
    const kinds = ["auth", "billing", "rate", "overloaded", "server", "timeout", "truncated", "malformed"] as const;
    for (const kind of kinds) expect(classify(err(kind, 500)).body).toContain("OpenAI");
    expect(classify(err("network")).body).toContain("api.openai.com");
  });

  it("puts the HTTP status in the code slot", () => {
    expect(classify(err("overloaded", 503)).code).toBe("HTTP 503");
    expect(classify(err("auth", 400)).code).toBe("HTTP 400");
  });

  // A proxy or a wrong URL often answers with an HTML error page; a cook should
  // never see 200 characters of markup in the callout.
  it("drops an HTML error page instead of printing it", () => {
    const page = "<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>";
    const onPreset = classify(err("rejected", 400, preset, page));
    expect(onPreset.body).toBe("OpenAI rejected the request.");
    const onCustom = classify(err("rejected", 400, custom, page));
    expect(onCustom.body).not.toContain("<");
    expect(onCustom.body).toMatch(/base URL/);
  });

  it("keeps the vendor's detail on a rejected request", () => {
    const c = classify(err("rejected", 400, preset, "effort is not supported"));
    expect(c.body).toContain("effort is not supported");
  });

  it("blames the model on a preset 404, and the URL on a Custom 404", () => {
    expect(classify(err("rejected", 404)).body).toContain("gpt-6-luna");
    const c = classify(err("rejected", 404, custom));
    expect(c.body).toContain("http://localhost:11434/v1/chat/completions");
    expect(c.body).toMatch(/base URL/);
  });

  it("only offers Fast/Thorough where that menu exists", () => {
    expect(classify(err("overloaded", 529)).body).toMatch(/Fast and Thorough/);
    expect(classify(err("overloaded", 529, custom)).body).not.toMatch(/Fast and Thorough/);
    expect(classify(err("overloaded", 529, custom)).body).toMatch(/another model/);
  });

  it("recognises an unreachable content script", () => {
    expect(classify(new Error("Could not read this page.")).label).toBe("PAGE UNREADABLE");
  });

  it("treats a missing key as setup, without naming a vendor", () => {
    const c = classify(new NoKeyError());
    expect(c.label).toBe("NO API KEY");
    expect(c.code).toBe("SETUP");
    expect(c.canRetry).toBe(false);
    expect(c.body).not.toMatch(/Anthropic/);
  });

  it("falls back to the raw message rather than swallowing it", () => {
    const c = classify(
      new Error("A custom provider needs a base URL and a model ID. Open Prep to add them."),
    );
    expect(c.label).toBe("EXTRACTION FAILED");
    expect(c.body).toMatch(/base URL/);
  });

  it("handles a thrown non-Error without crashing", () => {
    expect(classify("plain string").body).toBe("plain string");
  });
});

describe("renderError", () => {
  const failure = { label: "OVERLOADED", code: "HTTP 529", body: "Servers are busy." };

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
    expect(hdr.textContent).toContain("OVERLOADED");
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
