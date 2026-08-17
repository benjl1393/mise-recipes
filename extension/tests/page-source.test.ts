// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { pickSource, JSON_LD_SELECTOR } from "../src/lib/page-source";

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("pickSource", () => {
  it("prefers schema.org/Recipe JSON-LD and labels it 'schema data'", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":"Recipe","name":"Kimchi Jjigae","recipeYield":"4"}
    </script></head><body><p>ignored prose</p></body></html>`);
    const payload = pickSource(doc, "https://example.com/r/1");
    expect(payload.via).toBe("schema data");
    expect(payload.text).toContain("Kimchi Jjigae");
    expect(payload.text).not.toContain("ignored prose");
  });

  it("finds Recipe inside an @graph array", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Bibimbap"}]}
    </script></head><body></body></html>`);
    const payload = pickSource(doc, "https://example.com");
    expect(payload.via).toBe("schema data");
    expect(payload.text).toContain("Bibimbap");
  });

  it("handles @type given as an array", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":["Recipe","Article"],"name":"Doenjang Jjigae"}
    </script></head><body></body></html>`);
    expect(pickSource(doc, "https://example.com").via).toBe("schema data");
  });

  it("skips malformed ld+json without throwing", () => {
    const doc = docFrom(`<html><head>
      <script type="application/ld+json">{ not json </script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Japchae"}</script>
    </head><body></body></html>`);
    const payload = pickSource(doc, "https://example.com");
    expect(payload.via).toBe("schema data");
    expect(payload.text).toContain("Japchae");
  });

  it("ignores non-Recipe JSON-LD and falls through to article text", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":"BreadcrumbList"}
    </script></head><body><article>${"Cook the thing. ".repeat(30)}</article></body></html>`);
    const payload = pickSource(doc, "https://example.com");
    expect(payload.via).toBe("article text");
    expect(payload.text).toContain("Cook the thing.");
  });

  it("labels a short-text page carrying a video as 'caption only'", () => {
    const doc = docFrom(
      `<html><body><video src="blob:x"></video><p>Quick pasta: garlic, chilli, oil.</p></body></html>`,
    );
    const payload = pickSource(doc, "https://instagram.com/p/C9xK2");
    expect(payload.via).toBe("caption only");
    expect(payload.hasVideo).toBe(true);
  });

  it("reports hasVideo false on a plain article", () => {
    const doc = docFrom(`<html><body><article>${"Prose. ".repeat(50)}</article></body></html>`);
    expect(pickSource(doc, "https://example.com").hasVideo).toBe(false);
  });

  it("carries the source URL and document title through", () => {
    const doc = docFrom(`<html><head><title>Best Ragu</title></head>
      <body><article>${"Simmer. ".repeat(40)}</article></body></html>`);
    const payload = pickSource(doc, "https://example.com/ragu");
    expect(payload.source).toBe("https://example.com/ragu");
    expect(payload.title).toBe("Best Ragu");
  });

  it("exports the JSON-LD selector it uses", () => {
    expect(JSON_LD_SELECTOR).toBe('script[type="application/ld+json"]');
  });
});
