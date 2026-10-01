import type { Frontmatter, Recipe } from "../lib/types";

/**
 * Specimen 03A (type-specimens/popup-states.html), verbatim — the same card the
 * portfolio's stills show, so the page tells one recipe throughout.
 */
export const FIXTURE_RECIPE: Recipe = {
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
    "Uncover, turn skin-up, ladle sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.",
  ],
  tags: ["#cuisine/korean", "#pork", "#braise", "#weeknight"],
};

export const FIXTURE_SOURCE = "https://instagram.com/p/C9xK2";
export const FIXTURE_VIA = "8 video frames" as const;
export const FIRST_TICKET = 427;

export const fixtureFrontmatter = (ticket: number, captured: Date): Frontmatter => ({
  ticket,
  captured,
  source: FIXTURE_SOURCE,
  via: FIXTURE_VIA,
});
