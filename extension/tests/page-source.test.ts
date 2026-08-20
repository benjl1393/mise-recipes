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

/**
 * Instagram and TikTok are React shells: Readability finds no article, so the
 * raw body text is navigation, sidebar and comment chrome. Its length says
 * nothing about whether the page has prose — which is how a Reel used to be
 * classified "article text" and sent to Claude as a wall of menu items.
 */
describe("social video pages", () => {
  const CHROME =
    "Search Home Reels Messages Notifications Create Profile Log in Sign up ".repeat(20);

  const reel = (caption: string) =>
    docFrom(
      `<html><head><meta property="og:description" content="${caption}" /></head>` +
        `<body><div>${CHROME}</div><video src="v.mp4"></video></body></html>`,
    );

  it("reads the caption from og:description rather than the page shell", () => {
    const doc = reel("Crispy gochujang pork belly — 800g pork belly, 3 tbsp gochujang.");
    const payload = pickSource(doc, "https://instagram.com/reel/C9xK2");
    expect(payload.via).toBe("caption only");
    expect(payload.text).toContain("gochujang pork belly");
    expect(payload.text).not.toContain("Notifications");
  });

  it("does not let a long UI shell masquerade as an article", () => {
    expect(CHROME.length).toBeGreaterThan(400);
    expect(pickSource(reel("Short caption."), "https://instagram.com/reel/x").via).toBe(
      "caption only",
    );
  });

  it("falls back to twitter:description when og is absent", () => {
    const doc = docFrom(
      `<html><head><meta name="twitter:description" content="Tteokbokki in 15 minutes." />` +
        `</head><body><video></video></body></html>`,
    );
    const payload = pickSource(doc, "https://tiktok.com/@x/video/1");
    expect(payload.via).toBe("caption only");
    expect(payload.text).toBe("Tteokbokki in 15 minutes.");
  });

  it("still reports hasVideo so frames are captured", () => {
    expect(pickSource(reel("A caption."), "https://instagram.com/reel/x").hasVideo).toBe(true);
  });

  it("leaves a real article page on the article path", () => {
    const doc = docFrom(
      `<html><head><meta property="og:description" content="A teaser blurb." /></head>` +
        `<body><article><h1>Pork Belly</h1>` +
        "<p>Real prose about roasting pork belly slowly until the skin shatters.</p>".repeat(12) +
        `</article></body></html>`,
    );
    const payload = pickSource(doc, "https://example.com/pork");
    expect(payload.via).toBe("article text");
    expect(payload.text).toContain("skin shatters");
  });

  it("keeps schema data ahead of any caption", () => {
    const doc = docFrom(
      `<html><head><script type="application/ld+json">{"@type":"Recipe","name":"Japchae"}</script>` +
        `<meta property="og:description" content="ignore me" />` +
        `</head><body><video></video></body></html>`,
    );
    expect(pickSource(doc, "https://example.com").via).toBe("schema data");
  });
});
