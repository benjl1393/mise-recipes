// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createClient, extractRecipe, OffMenuError } from "../../src/lib/anthropic";
import { pickSource } from "../../src/lib/page-source";
import { serializeRecipe } from "../../src/lib/markdown";
import { normalizeTags } from "../../src/lib/tags";
import { liveKey, LIVE_MODEL } from "./key";

/**
 * Live-API tests. These make real, billed calls to api.anthropic.com.
 *
 * Everything in tests/*.test.ts mocks `client.messages.parse`, which proves
 * this code handles a well-formed response but proves nothing about whether
 * Anthropic produces one. These cover exactly that gap: that the request
 * shape is accepted, that structured output comes back in `parsed_output`,
 * that vision blocks are well formed, and that a real model declines a page
 * with no recipe instead of inventing one.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run test:live
 */

const key = liveKey();
const live = key ? describe : describe.skip;

if (!key) {
  console.warn(
    "\n[live] skipped — no ANTHROPIC_API_KEY in env or .env.local.\n" +
      "       Add it yourself (this repo never writes your key), then:\n" +
      "       npm run test:live\n",
  );
}

const doc = (html: string) => new DOMParser().parseFromString(html, "text/html");

const client = () => createClient(key!);

const BLOG = `<html><head><title>Weeknight Gochujang Pork Belly</title></head><body>
<article>
  <h1>Weeknight Gochujang Pork Belly</h1>
  <p>I first made this on a Tuesday when the fridge was nearly empty. It has
  become the thing I cook when people come over and I want to look like I tried
  harder than I did. Serves four generously, or two with leftovers.</p>
  <h2>Ingredients</h2>
  <ul>
    <li>800 g pork belly, skin on</li>
    <li>3 tablespoons gochujang</li>
    <li>2 tablespoons honey</li>
    <li>1.5 tablespoons light soy sauce</li>
    <li>4 cloves garlic, crushed</li>
    <li>1 thumb ginger, julienned</li>
    <li>Spring onion and sesame to finish</li>
  </ul>
  <h2>Method</h2>
  <ol>
    <li>Score the skin in a crosshatch and salt it heavily. Leave uncovered in
    the fridge overnight — this is not optional if you want crackling.</li>
    <li>Sear skin down in a dry cast iron pan until it blisters. Pour off most
    of the rendered fat.</li>
    <li>Whisk the gochujang, honey, soy, garlic and ginger with 100 ml water.
    Pour it around the pork, not over it. Cover and roast at 160 C for 90
    minutes.</li>
    <li>Uncover, turn skin up, and baste every few minutes for a final 15
    minutes at 200 C until lacquered. Rest, then slice thickly.</li>
  </ol>
  <p>Total time about 2 hours 10 minutes, of which maybe 25 minutes is actual
  work. Serve over rice with a soft egg.</p>
</article></body></html>`;

live("live extraction — text", () => {
  it("extracts a real recipe from an article page", async () => {
    const payload = pickSource(doc(BLOG), "https://example.com/gochujang-pork-belly");
    expect(payload.via).toBe("article text");

    const recipe = await extractRecipe(payload, {
      client: client(),
      units: "metric",
      model: LIVE_MODEL,
    });

    expect(recipe.title.toLowerCase()).toContain("pork belly");
    expect(recipe.ingredients.length).toBeGreaterThanOrEqual(5);
    expect(recipe.method.length).toBeGreaterThanOrEqual(3);
    expect(recipe.tags.length).toBeGreaterThanOrEqual(3);

    // Every ingredient must carry both halves — the .md aligns them in columns.
    for (const ing of recipe.ingredients) {
      expect(ing.qty.length).toBeGreaterThan(0);
      expect(ing.item.length).toBeGreaterThan(0);
    }

    // docs/mise-md-format.md:104 locks the quantity format to "1½ tbsp".
    // Left to itself the model mirrors the source's style, so a page written
    // in longhand yielded "1.5 tablespoons" until the prompt forbade it.
    const qtys = recipe.ingredients.map((i) => i.qty).join(" | ");
    expect(qtys).not.toMatch(/\b\d+\.\d/);
    expect(qtys).not.toMatch(/tablespoon|teaspoon|gram|millilit|ounce|pound/i);

    // Countable units stay in the qty column ("4 cloves" + "garlic"), not
    // shoved into the item — tightening the abbreviation rule above once
    // caused exactly that regression.
    for (const ing of recipe.ingredients) {
      expect(ing.item.toLowerCase()).not.toMatch(/^(cloves?|sprigs?|thumbs?|cans?|bunch)\b/);
    }

    // The whole point of the product: a serializable artifact.
    const md = serializeRecipe(recipe, {
      ticket: 1,
      captured: new Date("2026-08-17T18:00:00"),
      source: "https://example.com/gochujang-pork-belly",
      via: payload.via,
    });
    expect(md).toContain("---");
    expect(md).toContain("✶ mise.app");
    expect(md.endsWith("\n")).toBe(true);
    console.log(`\n[live] article →\n${md}\n`);
  });

  it("honours the imperial unit setting", async () => {
    const payload = pickSource(doc(BLOG), "https://example.com/gochujang-pork-belly");
    const recipe = await extractRecipe(payload, {
      client: client(),
      units: "imperial",
      model: LIVE_MODEL,
    });
    const text = recipe.ingredients.map((i) => i.qty).join(" ").toLowerCase();
    // Imperial output should not be leading with grams and millilitres.
    expect(/\b(oz|lb|cup|tbsp|tsp|inch|pound|ounce)/.test(text)).toBe(true);
    console.log(`\n[live] imperial qtys → ${text}\n`);
  });

  it("reads a schema.org/Recipe block", async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Cacio e Pepe",
      recipeYield: "2 servings",
      totalTime: "PT20M",
      recipeIngredient: [
        "200 g tonnarelli",
        "100 g pecorino romano, finely grated",
        "2 tsp black peppercorns, cracked",
      ],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Toast the cracked pepper in a dry pan." },
        { "@type": "HowToStep", text: "Cook pasta in minimal salted water." },
        { "@type": "HowToStep", text: "Emulsify pecorino with starchy water off the heat." },
      ],
    })}</script></head><body></body></html>`;

    const payload = pickSource(doc(html), "https://example.com/cacio");
    expect(payload.via).toBe("schema data");

    const recipe = await extractRecipe(payload, {
      client: client(),
      units: "metric",
      model: LIVE_MODEL,
    });
    expect(recipe.title.toLowerCase()).toContain("cacio");
    expect(recipe.ingredients.length).toBeGreaterThanOrEqual(3);
    console.log(`\n[live] schema → ${recipe.title} · ${recipe.serves}\n`);
  });

  // The `found: false` branch is what stops Mise inventing a recipe on a page
  // that has none. Only a real model can prove it fires.
  it("declines a page with no recipe instead of inventing one", async () => {
    const html = `<html><head><title>Quarterly Results</title></head><body><article>
      <h1>Quarterly Results</h1>
      <p>Revenue grew twelve percent year over year, driven by subscription
      renewals. Operating margin was flat. The board approved a buyback.</p>
      <p>Headcount rose to 480. Guidance for next quarter is unchanged.</p>
    </article></body></html>`;
    const payload = pickSource(doc(html), "https://example.com/earnings");

    await expect(
      extractRecipe(payload, { client: client(), units: "metric", model: LIVE_MODEL }),
    ).rejects.toBeInstanceOf(OffMenuError);
  });

  it("produces tags that survive normalisation", async () => {
    const payload = pickSource(doc(BLOG), "https://example.com/gochujang-pork-belly");
    const recipe = await extractRecipe(payload, {
      client: client(),
      units: "metric",
      model: LIVE_MODEL,
    });
    const tags = normalizeTags(recipe.tags, recipe.hands_on);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(5);
    for (const tag of tags) expect(tag.startsWith("#")).toBe(true);
    console.log(`\n[live] tags → ${tags.join(" ")}\n`);
  });
});
