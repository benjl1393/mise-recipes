// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { extractRecipe, OffMenuError } from "../../src/lib/extract";
import { resolveConnection } from "../../src/lib/providers/connection";
import { PRESETS, type PresetId } from "../../src/lib/providers/presets";
import type { ExtractionPayload } from "../../src/lib/page-source";
import { liveKey } from "./key";
import { chromium, renderFrame } from "./render-frame";

/**
 * One pass per vendor, on the Fast tier: text, a declined page, and frames.
 *
 * A vendor without a key in the environment is skipped, not failed. Until a
 * vendor's block has passed once, its preset is unverified (CLAUDE.md,
 * "Providers") — every unit test mocks the wire, so only this proves a vendor
 * accepts the request Mise builds.
 *
 *   OPENAI_API_KEY=… GEMINI_API_KEY=… npm run test:live
 */

const ENV: Record<PresetId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const article = (text: string, source: string): ExtractionPayload => ({
  via: "article text",
  text,
  source,
  title: "",
  hasVideo: false,
});

const RECIPE = `Weeknight Gochujang Pork Belly. Serves 4.
Ingredients: 800 g pork belly, skin on; 3 tablespoons gochujang; 2 tablespoons honey;
1.5 tablespoons light soy sauce; 4 cloves garlic, crushed; 1 thumb ginger, julienned.
Method: Score the skin and salt it overnight. Sear skin down until it blisters.
Whisk gochujang, honey, soy, garlic and ginger with 100 ml water, pour around the pork,
cover and roast at 160 C for 90 minutes. Rest 10 minutes and slice.`;

const NOT_A_RECIPE = `Quarterly results. Revenue rose four percent year on year,
driven by subscriptions. Operating margin held at twelve percent. The board approved
a dividend of 0.30 per share, payable next month.`;

for (const id of Object.keys(PRESETS) as PresetId[]) {
  const key = liveKey(ENV[id]);
  const suite = key ? describe : describe.skip;

  suite(`live — ${PRESETS[id].label} (${PRESETS[id].models.fast})`, () => {
    const connection = () =>
      resolveConnection({ apiKey: key!, provider: id, tier: "fast", baseURL: "", customModel: "" });

    it("extracts a recipe from article text", async () => {
      const recipe = await extractRecipe(article(RECIPE, "https://example.com/pork"), {
        connection: connection(),
        units: "metric",
      });
      expect(recipe.title.toLowerCase()).toContain("pork");
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(5);
      expect(recipe.method.length).toBeGreaterThanOrEqual(3);
    });

    it("declines a page with no recipe", async () => {
      await expect(
        extractRecipe(article(NOT_A_RECIPE, "https://example.com/results"), {
          connection: connection(),
          units: "metric",
        }),
      ).rejects.toBeInstanceOf(OffMenuError);
    });

    (chromium ? it : it.skip)(
      "reads a recipe from frames",
      async () => {
        const frames = [
          await renderFrame(
            "MISO BUTTER MUSHROOM UDON\n\n400 g fresh udon\n300 g mixed mushrooms\n2 tbsp white miso\n40 g butter",
          ),
          await renderFrame(
            "1. Fry the mushrooms in butter until golden.\n2. Stir in the miso and a splash of pasta water.\n3. Toss through the udon.",
          ),
          await renderFrame("Finish with spring onion and chilli oil."),
        ];
        const recipe = await extractRecipe(
          {
            via: "caption only",
            text: "udon 🍜",
            source: "https://instagram.com/reel/TEST",
            title: "",
            hasVideo: true,
          },
          { connection: connection(), units: "metric", frames },
        );
        expect(recipe.title.toLowerCase()).toContain("udon");
        expect(recipe.ingredients.map((i) => i.item.toLowerCase()).join(" ")).toMatch(/miso/);
      },
      180_000,
    );
  });
}
