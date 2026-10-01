import { filenameFor } from "../lib/fire";
import { serializeRecipe } from "../lib/markdown";
import type { Frontmatter } from "../lib/types";
import { ACTIONS, closingActions, relabel, SUCCESS_ACTIONS } from "../popup/actions";
import { renderCard, renderFired, renderSkeleton } from "../popup/render";
import { FIRST_TICKET, FIXTURE_RECIPE, FIXTURE_VIA, fixtureFrontmatter } from "./fixture";

/**
 * The portfolio's live Mise popup: the extension's own renderer, action rows
 * and serializer, driven by a fixture instead of a page and an API call.
 * Replay plays the real skeleton phases; Fire downloads the exact .md the
 * extension writes; where the extension would close, the card resets and the
 * ticket number moves on, as nextTicket() does.
 */

/** ~2.5s in total: long enough to read as extraction, short enough not to wait on. */
export const REPLAY_MS = { reading: 1000, extracting: 1500 } as const;
/** popup.ts closes after SPIKE_MS = 2000. */
export const CLOSE_AFTER_S = 2;
export const IN_THE_EXTENSION = "In the extension";

export interface EmbedOptions {
  now?: () => Date;
  reducedMotion?: boolean;
  download?: (markdown: string, filename: string) => void;
  clipboard?: Pick<Clipboard, "writeText">;
}

export interface Embed {
  replay(): void;
  fire(): void;
  readonly state: "idle" | "replaying" | "ready" | "fired";
  readonly ticket: number;
}

export function mountEmbed(doc: Document, opts: EmbedOptions = {}): Embed {
  const win = doc.defaultView!;
  const card = doc.getElementById("card")!;
  const actions = doc.getElementById("actions")!;
  const now = opts.now ?? (() => new Date());
  const download = opts.download ?? ((markdown: string, filename: string) => saveFile(doc, markdown, filename));
  const clipboard = opts.clipboard ?? win.navigator.clipboard;

  let state: Embed["state"] = "idle";
  let ticket = FIRST_TICKET;
  let fm: Frontmatter = fixtureFrontmatter(ticket, now());
  let timers: number[] = [];

  const clear = () => {
    for (const t of timers) win.clearTimeout(t);
    timers = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.push(win.setTimeout(fn, ms));
  };

  function setActions(html: string) {
    actions.innerHTML = html;
    for (const id of ["prep", "archive"]) {
      const b = actions.querySelector<HTMLButtonElement>(`#${id}`);
      if (!b) continue;
      // aria-disabled, not disabled: a disabled button gets no pointer
      // events, so its title would never show.
      b.setAttribute("aria-disabled", "true");
      b.title = IN_THE_EXTENSION;
    }
  }

  function skeleton(phase: "reading" | "extracting") {
    card.classList.remove("fired");
    // The shimmer is scoped to .skel .bar — without the class nothing animates.
    card.classList.add("skel");
    card.innerHTML = renderSkeleton(phase, {
      via: FIXTURE_VIA,
      elapsedMs: phase === "extracting" ? REPLAY_MS.reading : 0,
    });
  }

  function land() {
    clear();
    fm = fixtureFrontmatter(ticket, now());
    card.classList.remove("skel", "fired");
    card.innerHTML = renderCard(FIXTURE_RECIPE, fm);
    card.scrollTop = 0;
    setActions(SUCCESS_ACTIONS);
    state = "ready";
  }

  function replay() {
    if (opts.reducedMotion) return land();
    clear();
    state = "replaying";
    skeleton("reading");
    setActions(ACTIONS.extract);
    later(REPLAY_MS.reading, () => {
      skeleton("extracting");
      later(REPLAY_MS.extracting, land);
    });
  }

  function fire() {
    if (state !== "ready") return;
    state = "fired";
    const filename = filenameFor(FIXTURE_RECIPE, fm);
    download(serializeRecipe(FIXTURE_RECIPE, fm), filename);
    // The overlay is absolutely positioned; pin the card to the top first or
    // a scrolled card hides it (same as popup.ts onFire).
    card.scrollTop = 0;
    card.classList.add("fired");
    card.insertAdjacentHTML("beforeend", renderFired(filename));
    let remaining = CLOSE_AFTER_S;
    setActions(closingActions(remaining));
    const tick = () => {
      remaining -= 1;
      const slot = actions.querySelector(".countdown strong");
      if (slot) slot.textContent = `${Math.max(0, remaining)}s`;
      if (remaining > 0) return later(1000, tick);
      ticket += 1;
      land();
    };
    later(1000, tick);
  }

  async function copy(button: HTMLButtonElement) {
    if (state !== "ready") return;
    try {
      await clipboard.writeText(serializeRecipe(FIXTURE_RECIPE, fm));
      relabel(button, "Copied");
    } catch {
      relabel(button, "Can't copy");
    }
    later(1600, () => relabel(button, "Copy"));
  }

  actions.addEventListener("click", (event) => {
    const button = (event.target as Element).closest("button");
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    if (button.id === "fire") fire();
    if (button.id === "copy") void copy(button);
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || state !== "ready") return;
    event.preventDefault();
    fire();
  });

  if (opts.reducedMotion) {
    land();
  } else {
    skeleton("reading");
    setActions(ACTIONS.extract);
  }

  return {
    replay,
    fire,
    get state() { return state; },
    get ticket() { return ticket; },
  };
}

function saveFile(doc: Document, markdown: string, filename: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
