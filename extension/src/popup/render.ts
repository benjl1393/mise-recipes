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

/** Host and path, no scheme, no www. The CSS ellipsizes any overflow. */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return parsed.hostname.replace(/^www\./, "") + path;
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

export function renderSkeleton(via?: string): string {
  return `<div class="popup-body">
    <div class="ticket-top">
      <span class="brand">MISE</span>
      <span class="captured">READING</span>
    </div>
    <div class="source">
      <span class="url">&nbsp;</span>
      <span class="badge pending">${esc(via ?? "working")}</span>
    </div>
    <div class="title-skel"><span class="bar"></span><span class="bar"></span></div>
    <div class="subtitle-skel"><span class="bar"></span></div>
    <div class="facts-skel">
      <span class="bar"></span><span class="bar"></span><span class="bar"></span>
    </div>
    <ul class="ingredients-skel">
      <li><span class="bar"></span></li>
      <li><span class="bar"></span></li>
      <li><span class="bar"></span></li>
      <li><span class="bar"></span></li>
    </ul>
    <ol class="method-skel">
      <li><span class="bar"></span></li>
      <li><span class="bar"></span></li>
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
