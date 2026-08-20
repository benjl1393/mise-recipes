import { MARK_PLATE } from "./mark-geometry";

/**
 * Drawing the mark at runtime, in colours no exported asset contains.
 *
 * The toolbar icon animates, and `chrome.action.setIcon` only takes `ImageData`
 * for anything that isn't a packaged file. A service worker has no `document`,
 * so this goes through `OffscreenCanvas`. Geometry comes from the generated
 * module so the pulse and the shipped PNGs can't drift apart.
 */

/** Locked v2.2 tokens. See docs/mise-color-system.md. */
export const PAPER = "#fafafa"; // --paper-50
export const INK = "#232323"; // --ink-700
export const FLAME = "#cb1200"; // --flame

/**
 * One geometry for every size now.
 *
 * The rim-less 16px variant existed because a 1px outline breaks up when
 * downscaled. The plate is filled since 2026-08-20, and a solid disc survives
 * downscaling, so there is one shape to keep in step instead of two.
 */
export const GEOMETRY = MARK_PLATE;

const channel = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16);

/**
 * Mix two hex colours in sRGB.
 *
 * Not OKLCH, deliberately: ink→flame is a near-neutral to a saturated red, and
 * the pulse quantises to four steps anyway (see PULSE_RAMP), so the perceptual
 * evenness OKLCH buys is invisible here and not worth shipping a colour-space
 * conversion into the service worker for.
 */
export function mix(from: string, to: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const parts = [1, 3, 5].map((at) => {
    const value = Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * t);
    return value.toString(16).padStart(2, "0");
  });
  return `#${parts.join("")}`;
}

export interface MarkColors {
  /** The filled disc. */
  plate: string;
  /** The mono-M knocked out of it. */
  letter: string;
}

export function drawMark(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  colors: MarkColors,
): void {
  const scale = size / GEOMETRY.size;
  // No ground fill: the frame stays transparent so the mark sits on whatever
  // browser chrome it lands on rather than carrying its own tile.
  ctx.clearRect(0, 0, size, size);
  for (const [cells, fill] of [
    [GEOMETRY.plate, colors.plate],
    [GEOMETRY.letter, colors.letter],
  ] as const) {
    ctx.fillStyle = fill;
    for (const cell of cells) {
      ctx.fillRect(cell.x * scale, cell.y * scale, cell.w * scale, cell.h * scale);
    }
  }
}

/** One frame of the toolbar icon, ready for `chrome.action.setIcon`. */
export function markImageData(size: number, colors: MarkColors): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
  drawMark(ctx, size, colors);
  return ctx.getImageData(0, 0, size, size);
}

/** Chrome picks the closest size; supplying both avoids it rescaling one. */
export const ICON_SIZES = [16, 32] as const;

/**
 * The icon at one point on the heat ramp.
 *
 * The whole plate catches fire and the M stays paper, knocked out of it. This
 * replaced heating only the M on 2026-08-20: a filled disc changing colour is a
 * far larger signal than a few thin strokes changing colour, which is what a
 * 16px toolbar affordance needs.
 */
export function iconFrame(heat: number): Record<number, ImageData> {
  const colors: MarkColors = { plate: mix(INK, FLAME, heat), letter: PAPER };
  const frame: Record<number, ImageData> = {};
  for (const size of ICON_SIZES) frame[size] = markImageData(size, colors);
  return frame;
}
