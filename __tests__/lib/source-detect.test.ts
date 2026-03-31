import { describe, it, expect } from "vitest";
import { detectSource } from "@/lib/source-detect";

describe("detectSource", () => {
  it("detects youtube.com URLs", () => {
    expect(detectSource("https://www.youtube.com/watch?v=abc123")).toBe("youtube");
  });

  it("detects youtu.be short URLs", () => {
    expect(detectSource("https://youtu.be/abc123")).toBe("youtube");
  });

  it("detects instagram.com URLs", () => {
    expect(detectSource("https://www.instagram.com/p/abc123/")).toBe("instagram");
  });

  it("detects instagram reel URLs", () => {
    expect(detectSource("https://www.instagram.com/reel/abc123/")).toBe("instagram");
  });

  it("returns web for generic URLs", () => {
    expect(detectSource("https://seriouseats.com/best-chili-recipe")).toBe("web");
  });

  it("returns web for unknown domains", () => {
    expect(detectSource("https://example.com/recipe")).toBe("web");
  });
});
