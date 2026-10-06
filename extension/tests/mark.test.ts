import { describe, it, expect } from "vitest";
import { mix, GEOMETRY, INK, FLAME, PAPER } from "../src/lib/mark";
import { MARK_PLATE } from "../src/lib/mark-geometry";

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
  it("uses one geometry for the whole ladder", () => {
    // The rim-less 16px variant is gone: a filled disc downscales where a 1px
    // outline did not, so there is one shape rather than two to keep in step.
    expect(GEOMETRY).toBe(MARK_PLATE);
  });
});

describe("mark geometry", () => {
  it("carries both parts", () => {
    expect(MARK_PLATE.plate.length).toBeGreaterThan(0);
    expect(MARK_PLATE.letter.length).toBeGreaterThan(0);
  });

  it("has a filled plate, not an outline", () => {
    // A filled disc has far more cells than its own perimeter. If a future edit
    // reverted the SVG to a rim outline this would catch it, and the pulse
    // would silently go back to being a thin-stroke colour change.
    const rows = new Set(MARK_PLATE.plate.map((c) => c.y)).size;
    expect(MARK_PLATE.plate.length).toBeGreaterThan(rows * 4);
  });

  it("keeps every cell inside the coordinate space", () => {
    for (const cell of [...MARK_PLATE.plate, ...MARK_PLATE.letter]) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.w).toBeLessThanOrEqual(MARK_PLATE.size);
      expect(cell.y + cell.h).toBeLessThanOrEqual(MARK_PLATE.size);
    }
  });

  it("keeps the letter inside the plate's bounding box", () => {
    const bound = (cells: { x: number; y: number; w: number; h: number }[]) => ({
      x0: Math.min(...cells.map((c) => c.x)),
      y0: Math.min(...cells.map((c) => c.y)),
      x1: Math.max(...cells.map((c) => c.x + c.w)),
      y1: Math.max(...cells.map((c) => c.y + c.h)),
    });
    const plate = bound(MARK_PLATE.plate);
    const letter = bound(MARK_PLATE.letter);
    expect(letter.x0).toBeGreaterThan(plate.x0);
    expect(letter.y0).toBeGreaterThan(plate.y0);
    expect(letter.x1).toBeLessThan(plate.x1);
    expect(letter.y1).toBeLessThan(plate.y1);
  });

  it("is black-on-white, not the old paper-on-ink", () => {
    // The mark is drawn in INK on a PAPER ground. If someone re-inverts the
    // SVG source without meaning to, the pulse would ramp from near-white and
    // read as a flicker rather than a heat-up.
    expect(Number.parseInt(INK.slice(1, 3), 16)).toBeLessThan(0x80);
    expect(Number.parseInt(PAPER.slice(1, 3), 16)).toBeGreaterThan(0x80);
  });
});
