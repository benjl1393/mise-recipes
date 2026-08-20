// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { hasRecipe } from "../src/lib/detect-recipe";

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("hasRecipe", () => {
  it("sees a bare JSON-LD Recipe", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":"Recipe","name":"Kimchi Jjigae"}
    </script></head><body></body></html>`);
    expect(hasRecipe(doc)).toBe(true);
  });

  it("sees a Recipe nested in an @graph", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Bibimbap"}]}
    </script></head><body></body></html>`);
    expect(hasRecipe(doc)).toBe(true);
  });

  it("sees a Recipe declared as one of several @types", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":["Article","Recipe"],"name":"Congee"}
    </script></head><body></body></html>`);
    expect(hasRecipe(doc)).toBe(true);
  });

  it("sees a microdata Recipe when there is no JSON-LD at all", () => {
    const doc = docFrom(
      `<html><body><div itemscope itemtype="https://schema.org/Recipe"></div></body></html>`,
    );
    expect(hasRecipe(doc)).toBe(true);
  });

  it("accepts the http:// spelling of the microdata type", () => {
    const doc = docFrom(
      `<html><body><div itemscope itemtype="http://schema.org/Recipe"></div></body></html>`,
    );
    expect(hasRecipe(doc)).toBe(true);
  });

  it("is not fooled by a type that merely starts with Recipe", () => {
    const doc = docFrom(
      `<html><body><div itemscope itemtype="https://schema.org/RecipeInstruction"></div></body></html>`,
    );
    expect(hasRecipe(doc)).toBe(false);
  });

  it("steps over a malformed ld+json block and keeps looking", () => {
    const doc = docFrom(`<html><head>
      <script type="application/ld+json">{ not json at all }</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Dal"}</script>
    </head><body></body></html>`);
    expect(hasRecipe(doc)).toBe(true);
  });

  it("stays quiet on an ordinary article", () => {
    const doc = docFrom(`<html><head><script type="application/ld+json">
      {"@type":"NewsArticle","headline":"A restaurant opened"}
    </script></head><body><p>Prose about food.</p></body></html>`);
    expect(hasRecipe(doc)).toBe(false);
  });

  it("stays quiet on a page with no structured data", () => {
    const doc = docFrom(`<html><body><h1>Recipe</h1><p>1 cup flour</p></body></html>`);
    expect(hasRecipe(doc)).toBe(false);
  });
});
