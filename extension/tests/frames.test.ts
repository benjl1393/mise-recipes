import { describe, it, expect } from "vitest";
import {
  hammingDistance,
  dedupeFrames,
  perceptualHash,
  MAX_FRAMES,
} from "../src/lib/frames";

describe("hammingDistance", () => {
  it("is zero for identical hashes", () => {
    expect(hammingDistance(0b1011n, 0b1011n)).toBe(0);
  });

  it("counts differing bits", () => {
    expect(hammingDistance(0b1011n, 0b1001n)).toBe(1);
    expect(hammingDistance(0b0000n, 0b1111n)).toBe(4);
  });

  it("handles 64-bit hashes", () => {
    expect(hammingDistance(0xffffffffffffffffn, 0x0n)).toBe(64);
  });
});

describe("perceptualHash", () => {
  /** Build an w*h RGBA buffer from a per-pixel luma function. */
  function buffer(w: number, h: number, luma: (x: number, y: number) => number) {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = luma(x, y);
        const i = (y * w + x) * 4;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
        px[i + 3] = 255;
      }
    }
    return px;
  }

  it("returns a 64-bit hash", () => {
    const px = buffer(16, 16, (x) => (x < 8 ? 0 : 255));
    expect(perceptualHash(px, 16, 16)).toBeLessThan(1n << 64n);
  });

  it("gives identical images identical hashes", () => {
    const luma = (x: number, y: number) => (x + y) * 8;
    const a = perceptualHash(buffer(16, 16, luma), 16, 16);
    const b = perceptualHash(buffer(16, 16, luma), 16, 16);
    expect(a).toBe(b);
  });

  it("gives a left-dark and a right-dark image different hashes", () => {
    const left = perceptualHash(buffer(16, 16, (x) => (x < 8 ? 0 : 255)), 16, 16);
    const right = perceptualHash(buffer(16, 16, (x) => (x < 8 ? 255 : 0)), 16, 16);
    expect(hammingDistance(left, right)).toBeGreaterThan(DUPE_EQUIVALENT);
  });

  const DUPE_EQUIVALENT = 8;
});

describe("dedupeFrames", () => {
  it("drops near-identical consecutive frames", () => {
    const frames = [
      { data: "a", hash: 0b0000n },
      { data: "b", hash: 0b0001n }, // 1 bit apart — a near-duplicate
      { data: "c", hash: 0xffffn }, // clearly different
    ];
    expect(dedupeFrames(frames)).toEqual(["a", "c"]);
  });

  it("keeps every frame when all are distinct", () => {
    const frames = [
      { data: "a", hash: 0x0000n },
      { data: "b", hash: 0x0f0fn },
      { data: "c", hash: 0xf0f0n },
    ];
    expect(dedupeFrames(frames)).toEqual(["a", "b", "c"]);
  });

  it("caps at MAX_FRAMES to bound vision cost", () => {
    // Golden-ratio multiplier scatters bits so consecutive frames land far
    // apart in Hamming space — i.e. every frame is a genuinely distinct shot.
    const MASK = (1n << 64n) - 1n;
    const frames = Array.from({ length: 40 }, (_, i) => ({
      data: `f${i}`,
      hash: (BigInt(i + 1) * 0x9e3779b97f4a7c15n) & MASK,
    }));
    expect(dedupeFrames(frames)).toHaveLength(MAX_FRAMES);
  });

  it("returns an empty array for no input", () => {
    expect(dedupeFrames([])).toEqual([]);
  });
});
