// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { extractRecipe } from "../../src/lib/extract";
import { resolveConnection } from "../../src/lib/providers/connection";
import type { ExtractionPayload } from "../../src/lib/page-source";
import { liveKey, LIVE_MODEL } from "./key";
import { chromium, renderFrame } from "./render-frame";

/**
 * The vision path — the last genuinely unverified surface.
 *
 * Text extraction is proven in practice (real pages fire successfully), but
 * nothing has ever confirmed that the image content blocks this code builds
 * are accepted by the API, or that a model can read a captured frame. That is
 * the whole premise of the Reel/TikTok/YouTube feature.
 *
 * Frames are synthesised rather than captured from a real video: the wire
 * format and the model's ability to read on-screen recipe text are what is
 * under test, and a rendered card exercises both without needing a fixture
 * video committed to the repo.
 */

const key = liveKey();

const connection = () => ({
  ...resolveConnection({
    apiKey: key!,
    provider: "anthropic",
    tier: "fast",
    baseURL: "",
    customModel: "",
  }),
  model: LIVE_MODEL,
});

const live = key && chromium ? describe : describe.skip;

if (key && !chromium) {
  console.warn("\n[live] vision skipped — playwright not installed.\n");
}

const captionPayload = (text: string, source: string): ExtractionPayload => ({
  via: "caption only",
  text,
  source,
  title: "",
  hasVideo: true,
});

live("live extraction — vision", () => {
  let frames: string[] = [];

  beforeAll(async () => {
    // Two "frames" as a Reel would show them: ingredients, then method.
    frames = [
      await renderFrame(
        `MISO BUTTER MUSHROOM UDON\n\n` +
          `400 g fresh udon\n` +
          `300 g mixed mushrooms\n` +
          `2 tbsp white miso\n` +
          `40 g butter\n` +
          `2 cloves garlic\n` +
          `1 tbsp soy sauce`,
      ),
      await renderFrame(
        `METHOD\n\n` +
          `1. Tear mushrooms, sear hard in a dry pan\n` +
          `2. Add butter and garlic, foam it\n` +
          `3. Slacken miso with pasta water\n` +
          `4. Toss udon through, finish with soy`,
      ),
    ];
  }, 120_000);

  it("builds image blocks the API accepts", async () => {
    expect(frames.length).toBe(2);
    // captureFrames emits bare base64, never a data: URL — a data: prefix is
    // a 400 from the API.
    for (const frame of frames) {
      expect(frame.startsWith("data:")).toBe(false);
      expect(frame.length).toBeGreaterThan(1000);
    }

    const recipe = await extractRecipe(
      captionPayload("miso butter mushroom udon 🍜", "https://instagram.com/reel/TEST"),
      { connection: connection(), units: "metric", frames },
    );

    // Proof the model actually read the frames: none of this is in the caption.
    expect(recipe.title.toLowerCase()).toContain("udon");
    expect(recipe.ingredients.length).toBeGreaterThanOrEqual(4);
    const items = recipe.ingredients.map((i) => i.item.toLowerCase()).join(" ");
    expect(items).toContain("mushroom");
    expect(items).toMatch(/miso/);
    expect(recipe.method.length).toBeGreaterThanOrEqual(3);

    console.log(
      `\n[live] vision → ${recipe.title}\n` +
        recipe.ingredients.map((i) => `  ${i.qty}  |  ${i.item}`).join("\n") +
        `\n`,
    );
  });

  it("survives a frame the model cannot use", async () => {
    // A blank frame is common: transitions, letterboxing, a dark cut.
    const blank = await renderFrame(" ");
    const recipe = await extractRecipe(
      captionPayload("miso butter mushroom udon", "https://instagram.com/reel/TEST"),
      {
        connection: connection(),
        units: "metric",
        frames: [blank, ...frames],
      },
    );
    expect(recipe.ingredients.length).toBeGreaterThanOrEqual(3);
  });
});
