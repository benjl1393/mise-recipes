import { describe, it, expect } from "vitest";
import { extractFromHtml } from "@/lib/extractors/web";

const htmlWithJsonLd = `
<html>
<head>
<script type="application/ld+json">
{
  "@type": "Recipe",
  "name": "Test Recipe",
  "recipeIngredient": ["1 cup flour", "2 eggs"],
  "recipeInstructions": [
    {"text": "Mix flour and eggs."},
    {"text": "Bake at 350F."}
  ],
  "recipeYield": "4 servings",
  "prepTime": "PT10M",
  "cookTime": "PT30M",
  "description": "A simple test recipe."
}
</script>
</head>
<body><article><p>Some blog content about my life story before the recipe...</p></article></body>
</html>
`;

const htmlWithoutJsonLd = `
<html>
<body>
<article>
  <h1>Grandma's Cookies</h1>
  <p>These are the best cookies you'll ever make. Mix butter, sugar, and flour. Bake for 12 minutes.</p>
</article>
</body>
</html>
`;

describe("extractFromHtml", () => {
  it("extracts structured data from ld+json when present", () => {
    const result = extractFromHtml(htmlWithJsonLd);
    expect(result.jsonLd).toBeDefined();
    expect(result.jsonLd?.name).toBe("Test Recipe");
    expect(result.jsonLd?.recipeIngredient).toContain("1 cup flour");
  });

  it("extracts readable text content", () => {
    const result = extractFromHtml(htmlWithoutJsonLd);
    expect(result.textContent).toContain("Grandma's Cookies");
    expect(result.textContent).toContain("butter");
  });

  it("returns null jsonLd when no recipe schema exists", () => {
    const result = extractFromHtml(htmlWithoutJsonLd);
    expect(result.jsonLd).toBeNull();
  });
});
