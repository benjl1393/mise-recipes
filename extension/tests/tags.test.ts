import { describe, it, expect } from "vitest";
import { sanitizeTag, normalizeTags, parseDuration } from "../src/lib/tags";

describe("sanitizeTag", () => {
  it("lowercases and kebab-cases multi-word values", () => {
    expect(sanitizeTag("Slow Cooker")).toBe("#slow-cooker");
    expect(sanitizeTag("slow_cooker")).toBe("#slow-cooker");
    expect(sanitizeTag("slowCooker")).toBe("#slow-cooker");
  });

  it("preserves namespaces and kebab-cases only the value", () => {
    expect(sanitizeTag("Cuisine/South Korean")).toBe("#cuisine/south-korean");
  });

  it("is idempotent on an already-sanitized tag", () => {
    expect(sanitizeTag("#cuisine/korean")).toBe("#cuisine/korean");
  });

  it("strips characters that cannot appear in a tag", () => {
    expect(sanitizeTag("gluten free!")).toBe("#gluten-free");
    expect(sanitizeTag("  spaced  out  ")).toBe("#spaced-out");
  });

  it("returns empty string when nothing survives sanitization", () => {
    expect(sanitizeTag("!!!")).toBe("");
    expect(sanitizeTag("   ")).toBe("");
    expect(sanitizeTag("#")).toBe("");
  });
});

describe("parseDuration", () => {
  it("parses hours and minutes", () => {
    expect(parseDuration("25m")).toBe(25);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("1h 10m")).toBe(70);
    expect(parseDuration("2h 10m")).toBe(130);
  });

  it("returns null for unparseable input", () => {
    expect(parseDuration("overnight")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
});

describe("normalizeTags", () => {
  it("dedupes while preserving first-seen order", () => {
    expect(normalizeTags(["#pork", "Pork", "#braise"])).toEqual(["#pork", "#braise"]);
  });

  it("drops empties", () => {
    expect(normalizeTags(["#pork", "", "   ", "!!!"])).toEqual(["#pork"]);
  });

  it("adds #weeknight when hands_on is 45m or under", () => {
    expect(normalizeTags(["#pork"], "25m")).toContain("#weeknight");
    expect(normalizeTags(["#pork"], "45m")).toContain("#weeknight");
    expect(normalizeTags(["#pork"], "1h 10m")).not.toContain("#weeknight");
  });

  it("does not duplicate #weeknight when the model already supplied it", () => {
    const tags = normalizeTags(["#pork", "#weeknight"], "25m");
    expect(tags.filter((t) => t === "#weeknight")).toHaveLength(1);
  });

  it("caps at five tags", () => {
    expect(normalizeTags(["#a", "#b", "#c", "#d", "#e", "#f", "#g"])).toHaveLength(5);
  });
});
