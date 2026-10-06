/** Hard cap on frames sent to vision — bounds cost per extraction. */
export const MAX_FRAMES = 24;

/** Below this Hamming distance two frames are the same shot. */
const DUPE_THRESHOLD = 8;

/** Haiku 4.5 caps image input at 1568px on the long edge. */
const MAX_EDGE = 1568;

/** Downscale grid for the perceptual hash — 8x8 gives a 64-bit fingerprint. */
const HASH_EDGE = 8;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b;
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

/** Average-hash: 1 bit per cell, set when the cell is brighter than the mean. */
export function perceptualHash(pixels: Uint8ClampedArray, w: number, h: number): bigint {
  const cellW = w / HASH_EDGE;
  const cellH = h / HASH_EDGE;
  const cells: number[] = [];

  for (let row = 0; row < HASH_EDGE; row++) {
    for (let col = 0; col < HASH_EDGE; col++) {
      let sum = 0;
      let n = 0;
      for (let y = Math.floor(row * cellH); y < Math.floor((row + 1) * cellH); y++) {
        for (let x = Math.floor(col * cellW); x < Math.floor((col + 1) * cellW); x++) {
          const i = (y * w + x) * 4;
          // Rec. 601 luma — cheap, and good enough for shot-change detection.
          sum += 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!;
          n++;
        }
      }
      cells.push(n > 0 ? sum / n : 0);
    }
  }

  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  let hash = 0n;
  for (const cell of cells) hash = (hash << 1n) | (cell > mean ? 1n : 0n);
  return hash;
}

export function dedupeFrames(frames: Array<{ data: string; hash: bigint }>): string[] {
  const kept: Array<{ data: string; hash: bigint }> = [];
  for (const frame of frames) {
    const isDupe = kept.some((k) => hammingDistance(k.hash, frame.hash) < DUPE_THRESHOLD);
    if (!isDupe) kept.push(frame);
    if (kept.length >= MAX_FRAMES) break;
  }
  return kept.map((f) => f.data);
}

/** Base64-encode without blowing the argument limit on large buffers. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export interface CaptureOptions {
  /** Milliseconds between screenshots. */
  interval?: number;
  /** How long to sample for. */
  durationMs?: number;
  /**
   * The video's CSS-pixel box on the page. Screenshots capture the whole
   * viewport, so without this the model spends tokens on page chrome.
   */
  crop?: Rect | null;
  /** Screenshots come back in device pixels; the crop rect is in CSS pixels. */
  devicePixelRatio?: number;
}

/**
 * Screenshot the visible tab on an interval, crop to the player, hash each
 * frame, and return deduped base64 JPEGs sized for the vision cap.
 *
 * Requires `<all_urls>` — request it before calling.
 */
export async function captureFrames(
  tabId: number,
  {
    interval = 500,
    durationMs = 8000,
    crop = null,
    devicePixelRatio = 1,
  }: CaptureOptions = {},
): Promise<string[]> {
  const tab = await chrome.tabs.get(tabId);
  const frames: Array<{ data: string; hash: bigint }> = [];
  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline && frames.length < MAX_FRAMES * 2) {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 80,
    });
    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());

    // Crop to the player, clamped to the bitmap so a scrolled-off video
    // can't produce a zero or negative-sized source rect.
    const sx = crop ? Math.max(0, Math.round(crop.x * devicePixelRatio)) : 0;
    const sy = crop ? Math.max(0, Math.round(crop.y * devicePixelRatio)) : 0;
    const sw = crop
      ? Math.min(bitmap.width - sx, Math.round(crop.width * devicePixelRatio))
      : bitmap.width;
    const sh = crop
      ? Math.min(bitmap.height - sy, Math.round(crop.height * devicePixelRatio))
      : bitmap.height;

    if (sw <= 0 || sh <= 0) {
      bitmap.close();
      break;
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    bitmap.close();

    const hash = perceptualHash(ctx.getImageData(0, 0, w, h).data, w, h);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    const data = toBase64(new Uint8Array(await blob.arrayBuffer()));

    frames.push({ data, hash });
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return dedupeFrames(frames);
}
