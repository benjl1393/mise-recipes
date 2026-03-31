import { Recipe } from "./types";

export function recipeToMarkdown(recipe: Recipe): string {
  const lines: string[] = [];

  lines.push(`# ${recipe.title}`);
  lines.push("");
  lines.push(`> Source: ${recipe.source}`);
  lines.push(`> Extracted: ${new Date().toISOString().split("T")[0]}`);

  const details: string[] = [];
  if (recipe.servings) details.push(`- **Servings:** ${recipe.servings}`);
  if (recipe.prepTime) details.push(`- **Prep time:** ${recipe.prepTime}`);
  if (recipe.cookTime) details.push(`- **Cook time:** ${recipe.cookTime}`);

  if (details.length > 0) {
    lines.push("");
    lines.push("## Details");
    lines.push(...details);
  }

  lines.push("");
  lines.push("## Ingredients");
  for (const ingredient of recipe.ingredients) {
    lines.push(`- ${ingredient}`);
  }

  lines.push("");
  lines.push("## Steps");
  for (let i = 0; i < recipe.steps.length; i++) {
    lines.push(`${i + 1}. ${recipe.steps[i]}`);
  }

  if (recipe.notes.length > 0) {
    lines.push("");
    lines.push("## Notes");
    for (const note of recipe.notes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
