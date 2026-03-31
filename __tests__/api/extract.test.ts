import { describe, it, expect } from "vitest";
import { validateRequest } from "@/app/api/extract/route";

describe("validateRequest", () => {
  it("accepts a valid URL request", () => {
    const result = validateRequest({ url: "https://example.com/recipe", units: "metric" });
    expect(result.valid).toBe(true);
  });

  it("accepts a valid image request", () => {
    const result = validateRequest({ image: "data:image/jpeg;base64,abc123", units: "metric" });
    expect(result.valid).toBe(true);
  });

  it("accepts a valid text request", () => {
    const result = validateRequest({ text: "Here is my recipe...", units: "imperial" });
    expect(result.valid).toBe(true);
  });

  it("rejects request with no input", () => {
    const result = validateRequest({ units: "metric" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("url, image, or text");
  });

  it("rejects invalid units", () => {
    const result = validateRequest({ url: "https://example.com", units: "cubits" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("units");
  });

  it("rejects oversized image", () => {
    const bigImage = "data:image/jpeg;base64," + "a".repeat(7_000_000);
    const result = validateRequest({ image: bigImage, units: "metric" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("5MB");
  });
});
