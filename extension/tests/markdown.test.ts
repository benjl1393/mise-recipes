import { describe, it, expect } from "vitest";
import { serializeRecipe, formatTicket, formatCaptured } from "../src/lib/markdown";
import type { Recipe, Frontmatter } from "../src/lib/types";

const SEP = "  ·  ";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  subtitle: "slow-rendered, sharply-sauced, served over rice with a soft egg.",
  serves: "4",
  hands_on: "25m",
  total: "2h 10m",
  ingredients: [
    { qty: "800 g", item: "pork belly, skin-on" },
    { qty: "3 tbsp", item: "gochujang paste" },
    { qty: "2 tbsp", item: "honey or maltose" },
    { qty: "1½ tbsp", item: "soy sauce (light)" },
    { qty: "4 cloves", item: "garlic, crushed" },
    { qty: "1 thumb", item: "ginger, julienned" },
    { qty: "—", item: "spring onion & sesame to finish" },
  ],
  method: [
    "Score the pork belly skin in a crosshatch, just through the fat. Salt heavily, uncovered in the fridge overnight — this is non-negotiable.",
    "Sear skin-down in a dry cast-iron until the skin blisters and shatters when tapped. Drain most of the fat.",
    "Whisk gochujang, honey, soy, garlic and ginger with 100 ml water. Pour around (not over) the pork. Cover, oven 160 °C for 90 minutes.",
    "Uncover, turn skin-up, ladle the sticky sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.",
  ],
  tags: ["#cuisine/korean", "#pork", "#braise", "#weeknight"],
};

const fm: Frontmatter = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://instagram.com/p/C9xK2",
  via: "8 video frames",
};

describe("formatTicket", () => {
  it("zero-pads to five digits", () => {
    expect(formatTicket(427)).toBe("00427");
    expect(formatTicket(1)).toBe("00001");
    expect(formatTicket(99999)).toBe("99999");
  });
});

describe("formatCaptured", () => {
  it("emits ISO 8601 to the minute, no seconds, no zone", () => {
    expect(formatCaptured(new Date("2026-04-22T16:28:31"))).toBe("2026-04-22T16:28");
  });
});

describe("serializeRecipe", () => {
  const md = serializeRecipe(recipe, fm);

  it("matches the spec's full example byte for byte", () => {
    expect(md).toBe(
      [
        "---",
        "ticket: 00427",
        "captured: 2026-04-22T16:28",
        "source: https://instagram.com/p/C9xK2",
        "via: 8 video frames",
        "serves: 4",
        "hands_on: 25m",
        "total: 2h 10m",
        "---",
        "",
        "# Gochujang-Glazed Pork Belly",
        "",
        "*slow-rendered, sharply-sauced, served over rice with a soft egg.*",
        "",
        "## Ingredients",
        `- 800 g${SEP}pork belly, skin-on`,
        `- 3 tbsp${SEP}gochujang paste`,
        `- 2 tbsp${SEP}honey or maltose`,
        `- 1½ tbsp${SEP}soy sauce (light)`,
        `- 4 cloves${SEP}garlic, crushed`,
        `- 1 thumb${SEP}ginger, julienned`,
        `- —${SEP}spring onion & sesame to finish`,
        "",
        "## Method",
        "1. Score the pork belly skin in a crosshatch, just through the fat. Salt heavily, uncovered in the fridge overnight — this is non-negotiable.",
        "2. Sear skin-down in a dry cast-iron until the skin blisters and shatters when tapped. Drain most of the fat.",
        "3. Whisk gochujang, honey, soy, garlic and ginger with 100 ml water. Pour around (not over) the pork. Cover, oven 160 °C for 90 minutes.",
        "4. Uncover, turn skin-up, ladle the sticky sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.",
        "",
        "---",
        "#cuisine/korean · #pork · #braise · #weeknight",
        "",
        "✶ mise.app",
        "",
      ].join("\n"),
    );
  });

  it("ends with exactly one trailing newline after the footer", () => {
    expect(md.endsWith("mise.app\n")).toBe(true);
    expect(md.endsWith("mise.app\n\n")).toBe(false);
  });

  it("omits optional frontmatter fields when absent", () => {
    const bare = serializeRecipe({ ...recipe, hands_on: undefined, total: undefined }, fm);
    expect(bare).not.toContain("hands_on:");
    expect(bare).not.toContain("total:");
    expect(bare).toContain("serves: 4");
  });

  it("emits units and scaled only when set, after the time fields", () => {
    const scaled = serializeRecipe(recipe, { ...fm, units: "imperial", scaled: 1.5 });
    const lines = scaled.split("\n");
    expect(lines.indexOf("units: imperial")).toBeGreaterThan(lines.indexOf("total: 2h 10m"));
    expect(lines[lines.indexOf("units: imperial") + 1]).toBe("scaled: 1.5");
  });

  it("omits the subtitle block entirely when absent", () => {
    const md2 = serializeRecipe({ ...recipe, subtitle: undefined }, fm);
    expect(md2).toContain("# Gochujang-Glazed Pork Belly\n\n## Ingredients");
  });

  it("emits a Notes section when notes are present", () => {
    const md2 = serializeRecipe(
      { ...recipe, notes: ["Use Korean-brand gochujang.", "Marinate up to 48 hours."] },
      fm,
    );
    expect(md2).toContain(
      "## Notes\n- Use Korean-brand gochujang.\n- Marinate up to 48 hours.\n\n---\n",
    );
  });

  it("uses the five-character middle-dot separator for ingredients", () => {
    expect(md).toContain(`- 800 g${SEP}pork belly`);
    expect(SEP.length).toBe(5);
  });

  it("uses the narrow single-space separator for the tag line", () => {
    // The tag line is an inline run, not an aligned column — see
    // docs/mise-md-format.md § Tag line.
    expect(md).toContain("#cuisine/korean · #pork · #braise · #weeknight");
    expect(md).not.toContain(`#cuisine/korean${SEP}#pork`);
  });
});
