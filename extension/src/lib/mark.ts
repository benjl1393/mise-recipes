import { MARK_PLATE, MARK_SMALL, type MarkGeometry } from "./mark-geometry";

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

/** Below ~20px the 1px plate rim turns to mush, so the M ships alone. */
export function geometryFor(size: number): MarkGeometry {
  return size <= 20 ? MARK_SMALL : MARK_PLATE;
}

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

export function drawMark(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  ink: string,
  paper: string,
): void {
  const geometry = geometryFor(size);
  const scale = size / geometry.size;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = ink;
  for (const cell of geometry.cells) {
    ctx.fillRect(cell.x * scale, cell.y * scale, cell.w * scale, cell.h * scale);
  }
}

/** One frame of the toolbar icon, ready for `chrome.action.setIcon`. */
export function markImageData(size: number, ink: string, paper: string): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
  drawMark(ctx, size, ink, paper);
  return ctx.getImageData(0, 0, size, size);
}

/** Chrome picks the closest size; supplying both avoids it rescaling one. */
export const ICON_SIZES = [16, 32] as const;

/** The icon at one point on the ink→flame ramp, as a setIcon `imageData` map. */
export function iconFrame(heat: number): Record<number, ImageData> {
  const ink = mix(INK, FLAME, heat);
  const frame: Record<number, ImageData> = {};
  for (const size of ICON_SIZES) frame[size] = markImageData(size, ink, PAPER);
  return frame;
}
