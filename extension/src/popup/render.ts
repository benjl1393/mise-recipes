import { formatCaptured, formatTicket } from "../lib/markdown";
import type { Frontmatter, Recipe, ViaMethod } from "../lib/types";
import { GLYPH_BROKEN_PLATE, GLYPH_OFF_MENU } from "./glyphs";

/**
 * Markup here mirrors type-specimens/popup-states.html exactly — the ported
 * CSS keys off these tags and class names (h2.title, h3.section, .facts .fact
 * with a <strong> value, ol.method numbering via ::before). Changing a tag
 * here silently unstyles the card.
 */

/** Model output is untrusted text — never interpolate it raw. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "2026-04-24T18:03" -> "2026-04-24 · 18:03" — the ticket-stamp convention. */
export function stampTime(captured: Date): string {
  return formatCaptured(captured).replace("T", " · ");
}

/**
 * Host, path and query, no scheme, no www. The CSS ellipsizes any overflow.
 *
 * The query string is kept because on YouTube it *is* the identity of the
 * source — `youtube.com/watch` alone names every video ever posted. Tracking
 * params are dropped so the common case stays readable.
 */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|igshid$|si$|ref$|ref_src$|feature$)/;

export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) parsed.searchParams.delete(key);
    }
    const query = parsed.searchParams.toString();
    return parsed.hostname.replace(/^www\./, "") + path + (query ? `?${query}` : "");
  } catch {
    return url;
  }
}

/**
 * Source-type badge. Emoji are reserved for content like this — never for
 * functional chrome (CLAUDE.md § Icons).
 */
export function viaBadge(via: ViaMethod): string {
  const frames = /^(\d+) video frames$/.exec(via);
  if (frames) return `🎬 ${frames[1]} frames`;
  if (via === "caption only") return "🎬 caption";
  if (via === "schema data") return "📜 schema";
  if (via === "image upload") return "📷 photo";
  if (via === "manual paste") return "📝 pasted";
  return "📝 article";
}

function factsRow(recipe: Recipe): string {
  const facts: Array<[string, string | undefined]> = [
    ["SERVES", recipe.serves],
    ["HANDS-ON", recipe.hands_on],
    ["TOTAL", recipe.total],
  ];
  const cells = facts
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<span class="fact">${label} <strong>${esc(value!)}</strong></span>`)
    .join("");
  return `<div class="facts">${cells}</div>`;
}

export function renderCard(recipe: Recipe, fm: Frontmatter): string {
  const stamp = stampTime(fm.captured);
  // .popup-body is the layer the FIRED overlay dims — see renderFired.
  return `<div class="popup-body">
    <div class="ticket-top">
      <span class="brand">MISE · NO. ${formatTicket(fm.ticket)}</span>
      <span class="captured">${stamp}</span>
    </div>
    <div class="source">
      <span class="url">${esc(displayUrl(fm.source))}</span>
      <span class="badge">${esc(viaBadge(fm.via))}</span>
    </div>
    <h2 class="title">${esc(recipe.title)}</h2>
    ${recipe.subtitle ? `<p class="subtitle">${esc(recipe.subtitle)}</p>` : ""}
    ${factsRow(recipe)}
    <h3 class="section">Ingredients</h3>
    <ul class="ingredients">
      ${recipe.ingredients
        .map(
          ({ qty, item }) => `<li><span class="qty">${esc(qty)}</span><span>${esc(item)}</span></li>`,
        )
        .join("")}
    </ul>
    <h3 class="section">Method</h3>
    <ol class="method">
      ${recipe.method.map((step) => `<li>${esc(step)}</li>`).join("")}
    </ol>
    ${
      recipe.notes?.length
        ? `<h3 class="section">Notes</h3><ul class="ingredients notes">${recipe.notes
            .map((note) => `<li><span class="qty"></span><span>${esc(note)}</span></li>`)
            .join("")}</ul>`
        : ""
    }
    <div class="tags">
      ${recipe.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join(" · ")}
    </div>
    <div class="ticket-bottom">
      <span>${stamp}</span>
      <span><span class="glyph">✶</span> mise.app</span>
    </div>
  </div>`;
}

/**
 * Skeleton phases. Label and progress come from the specimen's chyron bar —
 * it tells the user which side of the ignition they're on, so the three
 * phases have to read as distinct stages, not one indeterminate spinner.
 */
export const PHASES = {
  reading: { label: "Opening · reading the page", progress: 8 },
  capturing: { label: "Capturing · sampling frames", progress: 42 },
  extracting: { label: "Extracting · Claude is reading", progress: 74 },
} as const;

export type Phase = keyof typeof PHASES;

/** "0:07" — the mono elapsed clock in the chyron's right slot. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const bar = (width: number, size = ""): string =>
  `<span class="bar${size ? ` ${size}` : ""}" style="width: ${width}%"></span>`;

/** Two-column ingredient rows: qty bar then item bar, uneven by design. */
const INGREDIENT_ROWS: Array<[number, number]> = [
  [60, 76],
  [50, 88],
  [64, 54],
  [42, 72],
];

/** Method steps wrap 2–3 body lines each, tapering like real prose. */
const METHOD_ROWS: number[][] = [
  [96, 88, 42],
  [92, 58],
  [84, 70],
];

/**
 * The loading card. The animation lives on `.skel .bar`, so the controller
 * must also put `skel` on the `.popup` container — without it the bars are
 * inert grey blocks (this is exactly how the shimmer went missing).
 */
export function renderSkeleton(
  phase: Phase = "reading",
  opts: { url?: string; via?: ViaMethod; elapsedMs?: number } = {},
): string {
  const { label, progress } = PHASES[phase];
  // The specimen reserves `.badge.pending` for an unresolved source ("4
  // targets", "no source"); once the source is known it becomes a normal
  // content badge.
  const badge = opts.via
    ? `<span class="badge">${viaBadge(opts.via)}</span>`
    : `<span class="badge pending">detecting</span>`;
  return `<div class="popup-body">
    <div class="ticket-top">
      <span class="brand">MISE · NO. ─────</span>
      <span class="captured">${esc(stampTime(new Date()))}</span>
    </div>
    <div class="source">
      <span class="url">${opts.url ? esc(displayUrl(opts.url)) : "&nbsp;"}</span>
      ${badge}
    </div>
    <div class="chyron-bar">
      <span class="status"><span class="dot"></span> ${esc(label)}</span>
      <span class="elapsed">${formatElapsed(opts.elapsedMs ?? 0)}</span>
    </div>
    <div class="progress" style="--progress: ${progress}%"></div>

    <div class="title-skel">${bar(82, "tallx")}${bar(54, "tall")}</div>
    <div class="subtitle-skel">${bar(92, "thin")}${bar(64, "thin")}</div>
    <div class="facts-skel">
      <span class="bar"></span><span class="bar"></span><span class="bar"></span>
    </div>

    <h3 class="section">Ingredients</h3>
    <ul class="ingredients-skel">
      ${INGREDIENT_ROWS.map(([qty, item]) => `<li>${bar(qty)}${bar(item)}</li>`).join("")}
    </ul>

    <h3 class="section">Method</h3>
    <ol class="method-skel">
      ${METHOD_ROWS.map(
        (lines) =>
          `<li><span></span><div class="body-skel">${lines
            .map((w) => bar(w, "thin"))
            .join("")}</div></li>`,
      ).join("")}
    </ol>
  </div>`;
}

/**
 * A terminal stamp that replaces the card: pixel-art glyph over a
 * normal-case title (the CSS uppercases it). "Kitchen Error" takes the
 * `.err` modifier — red is contextually exclusive per colour v2.2, so the
 * action row goes neutral whenever this is on screen.
 */
const STAMPS = {
  offmenu: { title: "Off Menu", glyph: GLYPH_OFF_MENU, modifier: "" },
  error: { title: "Kitchen Error", glyph: GLYPH_BROKEN_PLATE, modifier: " err" },
} as const;

export function renderStamp(kind: keyof typeof STAMPS, detail?: string): string {
  const { title, glyph, modifier } = STAMPS[kind];
  return (
    `<div class="popup-body">` +
    `<div class="stamp${modifier}" role="status">` +
    `<span class="glyph-mark">${glyph}</span>` +
    `<h2 class="stamp-title">${title}</h2>` +
    `</div>` +
    (detail ? `<p class="off-note">${esc(detail)}</p>` : "") +
    `</div>`
  );
}

/** One escape hatch in the error card's fallback list. */
export interface Fallback {
  /** Tabler-style glyph in the leading slot. */
  glyph: string;
  text: string;
  /** Keyboard hint, rendered in a .kbd chip. */
  key: string;
}

/**
 * The full Kitchen Error card: stamp, then a callout naming the failure, then
 * the fallback list. The stamp alone tells the user something broke; the
 * callout tells them which thing and what to do, which is the difference
 * between a dead end and a recoverable one.
 */
export function renderError(
  failure: { label: string; code: string; body: string },
  opts: { url?: string; fallbacks?: Fallback[] } = {},
): string {
  const { glyph } = STAMPS.error;
  const fallbacks = opts.fallbacks ?? [];
  return (
    `<div class="popup-body">` +
    `<div class="ticket-top">` +
    `<span class="brand">MISE · NO. ─────</span>` +
    `<span class="captured">${esc(stampTime(new Date()))}</span>` +
    `</div>` +
    `<div class="source">` +
    `<span class="url">${opts.url ? esc(displayUrl(opts.url)) : "&nbsp;"}</span>` +
    `<span class="badge pending">failed</span>` +
    `</div>` +
    `<div class="stamp err" role="status">` +
    `<span class="glyph-mark">${glyph}</span>` +
    `<h2 class="stamp-title">Kitchen Error</h2>` +
    `</div>` +
    `<div class="callout error" role="alert">` +
    `<div class="hdr"><span>▲ ${esc(failure.label)}</span>` +
    `<span class="code">${esc(failure.code)}</span></div>` +
    `<div class="body">${esc(failure.body)}</div>` +
    `</div>` +
    (fallbacks.length
      ? `<ul class="fallback-list">` +
        fallbacks
          .map(
            (f) =>
              `<li><span class="gl">${esc(f.glyph)}</span>` +
              `<span>${esc(f.text)}</span>` +
              `<span class="kbd">${esc(f.key)}</span></li>`,
          )
          .join("") +
        `</ul>`
      : "") +
    `<div class="ticket-bottom">` +
    `<span>ESC · CLOSE</span>` +
    `<span><span class="glyph">✶</span> mise.app</span>` +
    `</div>` +
    `</div>`
  );
}

/**
 * The FIRED receipt. The card stays on screen, dimmed, under the stamp —
 * the artifact is delivered, and the user sees what was written where.
 * Caller adds the `fired` class to the .popup element.
 */
export function renderFired(filename: string): string {
  return (
    `<div class="fired-stamp" aria-live="polite">` +
    `<div class="mark">` +
    `<div class="line1"><span class="check">✓</span><span>FIRED</span></div>` +
    `<div class="line2">saved to ${esc(filename)}</div>` +
    `</div></div>`
  );
}
