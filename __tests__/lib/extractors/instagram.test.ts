import { describe, it, expect } from "vitest";
import { buildOEmbedUrl, parseOEmbedCaption } from "@/lib/extractors/instagram";

describe("buildOEmbedUrl", () => {
  it("builds correct oEmbed URL for a post", () => {
    const url = buildOEmbedUrl("https://www.instagram.com/p/abc123/");
    expect(url).toBe(
      "https://graph.facebook.com/v18.0/instagram_oembed?url=https%3A%2F%2Fwww.instagram.com%2Fp%2Fabc123%2F&access_token=&maxwidth=658"
    );
  });
});

describe("parseOEmbedCaption", () => {
  it("extracts title (caption) from oEmbed response", () => {
    const response = {
      title: "The best pasta recipe! Ingredients: 200g pasta, 100g cheese...",
      author_name: "chefname",
      html: "<blockquote>...</blockquote>",
    };
    expect(parseOEmbedCaption(response)).toBe(
      "The best pasta recipe! Ingredients: 200g pasta, 100g cheese..."
    );
  });

  it("returns null when title is missing", () => {
    expect(parseOEmbedCaption({})).toBeNull();
  });
});
