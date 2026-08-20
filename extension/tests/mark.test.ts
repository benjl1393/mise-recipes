import { describe, it, expect } from "vitest";
import { mix, geometryFor, INK, FLAME, PAPER } from "../src/lib/mark";
import { MARK_PLATE, MARK_SMALL } from "../src/lib/mark-geometry";

describe("mix", () => {
  it("returns the endpoints unchanged", () => {
    expect(mix(INK, FLAME, 0)).toBe(INK);
    expect(mix(INK, FLAME, 1)).toBe(FLAME);
  });

  it("clamps out-of-range heat instead of producing junk hex", () => {
    expect(mix(INK, FLAME, -3)).toBe(INK);
    expect(mix(INK, FLAME, 42)).toBe(FLAME);
  });

  it("always emits a six-digit hex, including for channels below 0x10", () => {
    // FLAME is #cb1200 — the blue channel stays at 0x00 and the green channel
    // passes through single digits, which is where naive toString(16) breaks.
    for (let step = 0; step <= 10; step++) {
      expect(mix(INK, FLAME, step / 10)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("moves monotonically toward the target", () => {
    const red = (hex: string): number => parseInt(hex.slice(1, 3), 16);
    const ramp = [0, 0.34, 0.67, 1].map((heat) => red(mix(INK, FLAME, heat)));
    expect(ramp).toEqual([...ramp].sort((a, b) => a - b));
    expect(new Set(ramp).size).toBe(ramp.length);
  });
});

describe("geometryFor", () => {
  it("drops the plate rim at toolbar sizes and keeps it above", () => {
    expect(geometryFor(16)).toBe(MARK_SMALL);
    expect(geometryFor(32)).toBe(MARK_PLATE);
    expect(geometryFor(128)).toBe(MARK_PLATE);
  });
});

describe("mark geometry", () => {
  it("carries cells for both variants", () => {
    expect(MARK_PLATE.cells.length).toBeGreaterThan(0);
    expect(MARK_SMALL.cells.length).toBeGreaterThan(0);
  });

  it("keeps every cell inside its own coordinate space", () => {
    for (const geometry of [MARK_PLATE, MARK_SMALL]) {
      for (const cell of geometry.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.x + cell.w).toBeLessThanOrEqual(geometry.size);
        expect(cell.y + cell.h).toBeLessThanOrEqual(geometry.size);
      }
    }
  });

  it("is black-on-white, not the old paper-on-ink", () => {
    // The mark is drawn in INK on a PAPER ground. If someone re-inverts the
    // SVG source without meaning to, the pulse would ramp from near-white and
    // read as a flicker rather than a heat-up.
    expect(Number.parseInt(INK.slice(1, 3), 16)).toBeLessThan(0x80);
    expect(Number.parseInt(PAPER.slice(1, 3), 16)).toBeGreaterThan(0x80);
  });
});
