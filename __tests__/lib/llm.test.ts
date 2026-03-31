import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/llm";

describe("buildSystemPrompt", () => {
  it("includes metric instruction when units is metric", () => {
    const prompt = buildSystemPrompt("metric");
    expect(prompt).toContain("metric");
    expect(prompt).toContain("JSON");
  });

  it("includes imperial instruction when units is imperial", () => {
    const prompt = buildSystemPrompt("imperial");
    expect(prompt).toContain("imperial");
  });
});

describe("buildUserPrompt", () => {
  it("wraps text content with extraction instruction", () => {
    const prompt = buildUserPrompt("Here is a recipe for pasta with garlic and oil.");
    expect(prompt).toContain("Here is a recipe for pasta");
    expect(prompt).toContain("Extract the recipe");
  });

  it("truncates content over 50000 characters", () => {
    const longText = "a".repeat(60_000);
    const prompt = buildUserPrompt(longText);
    expect(prompt.length).toBeLessThan(55_000);
  });
});
