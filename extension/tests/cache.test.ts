import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import { readCache, writeCache, clearCache } from "../src/lib/cache";
import type { Frontmatter, Recipe } from "../src/lib/types";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  serves: "4",
  ingredients: [{ qty: "800 g", item: "pork belly" }],
  method: ["Score the skin.", "Roast."],
  tags: ["#pork"],
};

const fm = (): Frontmatter => ({
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00Z"),
  source: "https://example.com/pork",
  via: "article text",
});

const URL_A = "https://example.com/pork";

beforeEach(() => {
  vi.unstubAllGlobals();
  installChromeMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("extraction cache", () => {
  it("returns nothing for a tab never cached", async () => {
    expect(await readCache(1, URL_A)).toBeNull();
  });

  it("round-trips a recipe for the same tab and url", async () => {
    await writeCache(1, URL_A, recipe, fm());
    const hit = await readCache(1, URL_A);
    expect(hit?.recipe.title).toBe("Gochujang-Glazed Pork Belly");
    expect(hit?.fm.ticket).toBe(427);
  });

  it("revives captured as a real Date, not the serialized string", async () => {
    await writeCache(1, URL_A, recipe, fm());
    const hit = await readCache(1, URL_A);
    expect(hit?.fm.captured).toBeInstanceOf(Date);
    expect(hit?.fm.captured.toISOString()).toBe("2026-04-22T16:28:00.000Z");
  });

  // The bug this guards: a tab id is reused as the user navigates, so keying
  // on tab alone would serve a previous page's recipe.
  it("misses when the same tab has navigated elsewhere", async () => {
    await writeCache(1, URL_A, recipe, fm());
    expect(await readCache(1, "https://example.com/other")).toBeNull();
  });

  it("keeps tabs isolated from each other", async () => {
    await writeCache(1, URL_A, recipe, fm());
    expect(await readCache(2, URL_A)).toBeNull();
  });

  it("expires an entry older than the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T16:00:00Z"));
    await writeCache(1, URL_A, recipe, fm());
    expect(await readCache(1, URL_A)).not.toBeNull();

    // TTL is one hour; step just past it.
    vi.setSystemTime(new Date("2026-04-22T17:00:01Z"));
    expect(await readCache(1, URL_A)).toBeNull();
  });

  it("clears a single tab without disturbing the others", async () => {
    await writeCache(1, URL_A, recipe, fm());
    await writeCache(2, URL_A, recipe, fm());
    await clearCache(1);
    expect(await readCache(1, URL_A)).toBeNull();
    expect(await readCache(2, URL_A)).not.toBeNull();
  });

  it("clearing an unknown tab is a no-op", async () => {
    await writeCache(1, URL_A, recipe, fm());
    await clearCache(99);
    expect(await readCache(1, URL_A)).not.toBeNull();
  });

  it("evicts the oldest tab beyond the entry cap", async () => {
    vi.useFakeTimers();
    // 21 tabs against a cap of 20: tab 0 is the oldest and must fall out.
    for (let i = 0; i < 21; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 3, 22, 16, 0, i)));
      await writeCache(i, `https://example.com/${i}`, recipe, fm());
    }
    expect(await readCache(0, "https://example.com/0")).toBeNull();
    expect(await readCache(20, "https://example.com/20")).not.toBeNull();
  });

  it("degrades to no-cache when the runtime has no session area", async () => {
    vi.unstubAllGlobals();
    installChromeMock({}, { withSession: false });
    // Must not throw — a missing session area costs a re-extract, not a crash.
    await expect(writeCache(1, URL_A, recipe, fm())).resolves.toBeUndefined();
    expect(await readCache(1, URL_A)).toBeNull();
    await expect(clearCache(1)).resolves.toBeUndefined();
  });
});
