import { describe, it, expect } from "vitest";
import { recipeToMarkdown } from "@/lib/markdown";
import { Recipe } from "@/lib/types";

const fullRecipe: Recipe = {
  title: "Classic Marinara",
  source: "https://example.com/marinara",
  servings: "4",
  prepTime: "10 minutes",
  cookTime: "30 minutes",
  ingredients: ["400g canned tomatoes", "3 cloves garlic", "Fresh basil"],
  steps: ["Crush garlic and sauté in olive oil.", "Add tomatoes and simmer 25 minutes.", "Stir in basil and season."],
  notes: ["Use San Marzano tomatoes for best results."],
};

describe("recipeToMarkdown", () => {
  it("renders a full recipe with all fields", () => {
    const md = recipeToMarkdown(fullRecipe);
    expect(md).toContain("# Classic Marinara");
    expect(md).toContain("> Source: https://example.com/marinara");
    expect(md).toContain("> Extracted:");
    expect(md).toContain("**Servings:** 4");
    expect(md).toContain("**Prep time:** 10 minutes");
    expect(md).toContain("**Cook time:** 30 minutes");
    expect(md).toContain("- 400g canned tomatoes");
    expect(md).toContain("1. Crush garlic");
    expect(md).toContain("## Notes");
    expect(md).toContain("- Use San Marzano");
  });

  it("omits Details section when all detail fields are null", () => {
    const recipe: Recipe = { ...fullRecipe, servings: null, prepTime: null, cookTime: null };
    const md = recipeToMarkdown(recipe);
    expect(md).not.toContain("## Details");
    expect(md).not.toContain("**Servings:**");
  });

  it("omits Notes section when notes array is empty", () => {
    const recipe: Recipe = { ...fullRecipe, notes: [] };
    const md = recipeToMarkdown(recipe);
    expect(md).not.toContain("## Notes");
  });

  it("only includes non-null detail fields", () => {
    const recipe: Recipe = { ...fullRecipe, prepTime: null };
    const md = recipeToMarkdown(recipe);
    expect(md).toContain("**Servings:** 4");
    expect(md).not.toContain("**Prep time:**");
    expect(md).toContain("**Cook time:** 30 minutes");
  });
});
