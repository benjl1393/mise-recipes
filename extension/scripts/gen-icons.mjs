/**
 * Rasterise the Mise mark from its SVG source into the shipped PNG ladder, and
 * emit the same geometry as a TS module for the service worker to draw at
 * runtime.
 *
 * Why this exists rather than an export step in a design tool: the toolbar icon
 * is now animated (it pulses when a recipe is detected), so the mark has to be
 * drawable at runtime in colours that don't exist in any exported asset. Two
 * copies of the geometry — one in the PNGs, one hand-typed for canvas — would
 * drift the first time the mark is touched. So the SVG stays the design source
 * of truth and everything else is generated from it.
 *
 * No image dependency on purpose: the mark is axis-aligned rectangles on a
 * solid ground, which is a few dozen lines of zlib and CRC away from a valid
 * PNG. `sharp` only exists here transitively via Next, and a generation script
 * that breaks when an unrelated dependency moves is a trap.
 *
 * Usage: node extension/scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = (...parts) => resolve(here, ...parts);

const MARK_DIR = from("../../type-specimens/mark");
const PNG_DIR = `${MARK_DIR}/png`;
const GEOMETRY_OUT = from("../src/lib/mark-geometry.ts");

/** The ladder Chrome asks for. 16 uses the rim-less variant; a 1px rim dies there. */
const SIZES = [16, 32, 48, 128];

// ---------------------------------------------------------------------------
// SVG → geometry
// ---------------------------------------------------------------------------

/**
 * Pull the ground colour, the mark colour and the mark cells out of one of the
 * two icon SVGs. This is deliberately not a general SVG parser — it understands
 * exactly the shape those two files are authored in (a ground `<rect>`, then a
 * single translated `<g>` of `<rect>`s) and throws if that shape changes, which
 * is the behaviour you want from a codegen step.
 */
export function parseMarkSvg(path) {
  const svg = readFileSync(path, "utf8");

  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!viewBox) throw new Error(`${path}: no viewBox`);
  const size = Number(viewBox[1]);

  const ground = svg.match(/<rect width="\d+" height="\d+" fill="(#[0-9a-fA-F]{6})"\/>/);
  if (!ground) throw new Error(`${path}: no ground rect`);

  const group = svg.match(/<g fill="(#[0-9a-fA-F]{6})" transform="translate\((-?\d+) (-?\d+)\)">([\s\S]*?)<\/g>/);
  if (!group) throw new Error(`${path}: no translated mark group`);
  const [, ink, dxRaw, dyRaw, body] = group;
  const dx = Number(dxRaw);
  const dy = Number(dyRaw);

  const cells = [];
  const rect = /<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"\/>/g;
  for (let m = rect.exec(body); m; m = rect.exec(body)) {
    // Bake the group transform in so consumers never have to know about it.
    cells.push({ x: Number(m[1]) + dx, y: Number(m[2]) + dy, w: Number(m[3]), h: Number(m[4]) });
  }
  if (cells.length === 0) throw new Error(`${path}: mark group has no rects`);

  return { size, paper: ground[1], ink, cells };
}

// ---------------------------------------------------------------------------
// Geometry → pixels
// ---------------------------------------------------------------------------

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Supersampling factor. The mark rarely lands on whole pixels at 48px. */
const SS = 4;

/**
 * Render the mark to an RGBA buffer at `out` pixels square.
 *
 * Coverage-based antialiasing rather than a hard threshold: at 48px the 8-unit
 * cell scales to 3px but the group's x-offset lands on a half pixel, so
 * thresholding would shift the whole mark a pixel left or right and break the
 * plate's symmetry. Averaging keeps it centred.
 */
export function render(geometry, out) {
  const { size, cells } = geometry;
  const [pr, pg, pb] = hexToRgb(geometry.paper);
  const [ir, ig, ib] = hexToRgb(geometry.ink);

  // Mark a supersampled coverage grid, then box-filter it down.
  const hi = out * SS;
  const covered = new Uint8Array(hi * hi);
  const scale = hi / size;
  for (const cell of cells) {
    const x0 = Math.round(cell.x * scale);
    const y0 = Math.round(cell.y * scale);
    const x1 = Math.round((cell.x + cell.w) * scale);
    const y1 = Math.round((cell.y + cell.h) * scale);
    for (let y = y0; y < y1; y++) {
      if (y < 0 || y >= hi) continue;
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= hi) continue;
        covered[y * hi + x] = 1;
      }
    }
  }

  const rgba = Buffer.alloc(out * out * 4);
  const samples = SS * SS;
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        const row = (y * SS + sy) * hi + x * SS;
        for (let sx = 0; sx < SS; sx++) hits += covered[row + sx];
      }
      const a = hits / samples;
      const i = (y * out + x) * 4;
      rgba[i] = Math.round(pr + (ir - pr) * a);
      rgba[i + 1] = Math.round(pg + (ig - pg) * a);
      rgba[i + 2] = Math.round(pb + (ib - pb) * a);
      rgba[i + 3] = 255; // the tile is a solid ground, per the black-on-white brief
    }
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// Pixels → PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng(rgba, width, height = width) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10–12 stay zero: deflate, adaptive filtering, no interlace.

  // One filter byte per scanline. Filter 0 (None) — the mark is flat colour,
  // so the filters that help photographs only cost bytes here.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1);
    raw[at] = 0;
    rgba.copy(raw, at + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

export const PLATE_SVG = `${MARK_DIR}/mise-plate-icon.svg`;
export const SMALL_SVG = `${MARK_DIR}/mise-plate-icon-16.svg`;

/**
 * Guarded so the renderer above can be imported — by a test, or by the pulse
 * preview — without a bare import silently rewriting the committed PNGs.
 */
function main() {
const full = parseMarkSvg(PLATE_SVG);
const small = parseMarkSvg(SMALL_SVG);

mkdirSync(PNG_DIR, { recursive: true });
for (const size of SIZES) {
  const geometry = size <= 16 ? small : full;
  writeFileSync(`${PNG_DIR}/mise-icon-${size}.png`, encodePng(render(geometry, size), size));
  console.log(`[mise] icons/mise-icon-${size}.png  (${geometry === small ? "rim-less" : "plate"})`);
}

const serialise = (geometry) =>
  `{\n  size: ${geometry.size},\n  cells: [\n${geometry.cells
    .map((c) => `    { x: ${c.x}, y: ${c.y}, w: ${c.w}, h: ${c.h} },`)
    .join("\n")}\n  ],\n}`;

writeFileSync(
  GEOMETRY_OUT,
  `// GENERATED by extension/scripts/gen-icons.mjs — do not edit by hand.
// Source of truth: type-specimens/mark/mise-plate-icon{,-16}.svg
// Regenerate with: node extension/scripts/gen-icons.mjs

export interface MarkCell {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MarkGeometry {
  /** Edge length of the coordinate space the cells are expressed in. */
  size: number;
  cells: MarkCell[];
}

/** Plate rim + mono-M. The mark proper. */
export const MARK_PLATE: MarkGeometry = ${serialise(full)};

/** M only. Below ~20px the 1px plate rim turns to mush, so it is dropped. */
export const MARK_SMALL: MarkGeometry = ${serialise(small)};
`,
);
console.log(`[mise] src/lib/mark-geometry.ts  (${full.cells.length} + ${small.cells.length} cells)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
