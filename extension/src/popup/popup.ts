import { createClient, extractRecipe, OffMenuError } from "../lib/anthropic";
import { clearCache, readCache, writeCache } from "../lib/cache";
import { captureFrames } from "../lib/frames";
import { fire, filenameFor } from "../lib/fire";
import { getSettings, nextTicket, peekTicket } from "../lib/storage";
import type { ExtractionPayload } from "../lib/page-source";
import type { Frontmatter, Recipe, ViaMethod } from "../lib/types";
import {
  formatElapsed,
  renderCard,
  renderError,
  renderFired,
  renderSkeleton,
  renderStamp,
  type Fallback,
  type Phase,
} from "./render";
import { classify, NoKeyError } from "./errors";

const card = document.getElementById("card") as HTMLElement;
const actions = document.querySelector(".popup-actions") as HTMLElement;

/**
 * The action row is rebuilt for the error and fired states, which detaches
 * any element reference held across that swap — so buttons are always looked
 * up fresh rather than captured once at load.
 */
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const fireBtn = () => byId<HTMLButtonElement>("fire");

/** Pristine markup for the default row, so a retry can restore it. */
const DEFAULT_ACTIONS = actions.innerHTML;

/**
 * How long the FIRED receipt sits before the popup closes behind it.
 * The specimen's fired state advertises "Closing in 2s".
 */
const SPIKE_MS = 2000;

let current: { recipe: Recipe; fm: Frontmatter } | null = null;
let activeTabId: number | null = null;
let activeTabUrl = "";

/** Kept so a failed extraction can still hand the user the raw page text. */
let lastPageText = "";

/** Ticks the chyron's elapsed clock while a skeleton is on screen. */
let elapsedTimer: number | null = null;
let phaseStartedAt = 0;

interface ExtractReply {
  ok: boolean;
  error?: string;
  payload: ExtractionPayload;
  videoRect: { x: number; y: number; width: number; height: number } | null;
  devicePixelRatio: number;
}

function stopElapsed() {
  if (elapsedTimer !== null) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

/**
 * Leaving the skeleton means dropping `skel` — the shimmer animation is
 * scoped to `.skel .bar`, so a lingering class would animate nothing but
 * still misreport the card as loading to assistive tech.
 */
function settle() {
  stopElapsed();
  card.classList.remove("skel");
  card.setAttribute("aria-busy", "false");
}

/** Wire the default action row. Re-run whenever that row is rebuilt. */
function bindActions() {
  fireBtn()?.addEventListener("click", () => void onFire());
  byId("prep")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  byId("pass")?.addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("pass/pass.html") }),
  );
}

function showStamp(kind: "error" | "offmenu", detail?: string) {
  settle();
  card.innerHTML = renderStamp(kind, detail);
  // Colour v2.2 wants red contextually exclusive — action OR failure per
  // screen. Disabling Fire already drops it to neutral ink, so a stamped
  // card never shows two reds.
  const btn = fireBtn();
  if (btn) btn.disabled = true;
}

/**
 * The Kitchen Error card, plus the action row the specimen calls for: Fire is
 * replaced by Retry, because there is no artifact to save. That swap is also
 * what keeps colour v2.2's rule intact — the row's red belongs to Retry now,
 * and the callout carries the failure.
 */
function showError(error: unknown) {
  const failure = classify(error);
  settle();

  const fallbacks: Fallback[] = [];
  if (failure.canRetry) {
    fallbacks.push({ glyph: "↻", text: "Retry with the same model", key: "↵" });
  }
  if (lastPageText) {
    fallbacks.push({ glyph: "⎘", text: "Copy raw page text (fire to .md manually)", key: "⌘C" });
  }
  fallbacks.push({ glyph: "→", text: "Open Prep to change key or model", key: "P" });

  card.innerHTML = renderError(failure, { url: activeTabUrl, fallbacks });

  const retry = failure.canRetry
    ? `<button id="retry" class="retry-btn" type="button">` +
      `<span>RETRY</span><span class="kbd">↵</span></button>`
    : "";
  const copy = lastPageText
    ? `<button id="copy" class="secondary-btn" type="button">Copy text</button>`
    : "";
  actions.innerHTML =
    retry + copy + `<button id="prep" class="secondary-btn" type="button">Prep</button>`;

  byId("retry")?.addEventListener("click", () => void run());
  byId("prep")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  byId("copy")?.addEventListener("click", () => void copyPageText());

  (byId("retry") ?? byId("prep"))?.focus();
}

async function copyPageText() {
  if (!lastPageText) return;
  try {
    await navigator.clipboard.writeText(lastPageText);
    const btn = byId("copy");
    if (btn) btn.textContent = "Copied";
  } catch {
    // Clipboard can be refused; the fallback list still names the option.
  }
}

interface SkeletonOpts {
  url?: string;
  via?: ViaMethod;
}

function showSkeleton(phase: Phase, opts: SkeletonOpts = {}) {
  card.setAttribute("aria-busy", "true");
  // The animation selector is `.skel .bar`; without this class the bars are
  // inert grey blocks — which is exactly how the shimmer went missing.
  card.classList.add("skel");

  // The clock spans the whole run, not each phase, so it only starts once.
  if (elapsedTimer === null) phaseStartedAt = Date.now();
  card.innerHTML = renderSkeleton(phase, { ...opts, elapsedMs: Date.now() - phaseStartedAt });

  if (elapsedTimer === null) {
    elapsedTimer = setInterval(() => {
      const slot = card.querySelector(".elapsed");
      if (slot) slot.textContent = formatElapsed(Date.now() - phaseStartedAt);
    }, 1000) as unknown as number;
  }
}

/** A stashed right-click selection is only fresh for this long. */
const SELECTION_TTL_MS = 30_000;

interface StashedSelection {
  text: string;
  source: string;
  tabId: number;
  at: number;
}

/**
 * "Fire selected text to Mise" stashes a selection via the context menu;
 * consume it once, in preference to scraping the whole page.
 */
async function takeSelection(tabId: number): Promise<ExtractionPayload | null> {
  const stored = await chrome.storage.local.get("mise:selection");
  const selection = stored["mise:selection"] as StashedSelection | undefined;
  if (!selection) return null;

  await chrome.storage.local.remove("mise:selection");
  if (selection.tabId !== tabId || Date.now() - selection.at > SELECTION_TTL_MS) return null;

  return {
    via: "manual paste",
    text: selection.text,
    source: selection.source,
    title: "",
    hasVideo: false,
  };
}

async function askContentScript(tabId: number): Promise<ExtractReply> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content/extract.js"] });
  const reply = (await chrome.tabs.sendMessage(tabId, { type: "mise:extract" })) as
    | ExtractReply
    | undefined;
  if (!reply?.ok) throw new Error(reply?.error ?? "Could not read this page.");
  return reply;
}

/** Hand the card to the user: render, enable Fire, take focus for Enter. */
function present(recipe: Recipe, fm: Frontmatter) {
  current = { recipe, fm };
  settle();
  card.innerHTML = renderCard(recipe, fm);
  const btn = fireBtn();
  if (btn) {
    btn.disabled = false;
    btn.focus();
  }
}

async function run() {
  // A retry re-enters here with the error row on screen; put Fire back.
  actions.innerHTML = DEFAULT_ACTIONS;
  bindActions();
  current = null;
  showSkeleton("reading");

  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new NoKeyError();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");
    activeTabId = tab.id;
    activeTabUrl = tab.url ?? "";

    // Chrome tears the popup down on every tab switch. Re-showing a recipe we
    // already extracted must not cost another billed API call.
    const cached = await readCache(tab.id, activeTabUrl);
    if (cached) {
      present(cached.recipe, cached.fm);
      return;
    }

    showSkeleton("reading", { url: activeTabUrl });

    const selection = await takeSelection(tab.id);
    const reply = selection ? null : await askContentScript(tab.id);
    const payload = selection ?? reply!.payload;
    // Stashed before extraction so a failure can still offer "Copy text".
    lastPageText = payload.text;

    let frames: string[] = [];
    if (reply && payload.hasVideo && settings.captureFrames) {
      showSkeleton("capturing", { url: activeTabUrl, via: payload.via });
      try {
        // No permissions.request() here. `activeTab` already grants
        // captureVisibleTab on the tab the user invoked us from, and
        // permissions.request() requires a live user gesture — which is long
        // gone after awaiting settings, the tab query, the cache and the
        // content script. Asking here threw and killed every video capture.
        frames = await captureFrames(tab.id, {
          crop: reply.videoRect,
          devicePixelRatio: reply.devicePixelRatio,
        });
        if (frames.length > 0) {
          payload.via = `${frames.length} video frames` as ViaMethod;
        }
      } catch {
        // A caption plus no frames still beats no recipe at all — the caption
        // on a Reel is usually the recipe. Fall through with what we have.
      }
    }

    showSkeleton("extracting", { url: activeTabUrl, via: payload.via });
    const recipe = await extractRecipe(payload, {
      client: createClient(settings.apiKey),
      units: settings.units,
      model: settings.model,
      frames,
    });

    const fm: Frontmatter = {
      // Peek, don't claim — an abandoned extraction must not burn a number.
      // onFire() commits the real one.
      ticket: await peekTicket(),
      captured: new Date(),
      source: payload.source,
      via: payload.via,
      // Only recorded when the user overrode the default (docs/mise-md-format.md).
      units: settings.units === "metric" ? undefined : settings.units,
    };

    present(recipe, fm);
    await writeCache(tab.id, activeTabUrl, recipe, fm);
  } catch (error) {
    if (error instanceof OffMenuError) {
      showStamp("offmenu", "Nothing to extract here.");
      return;
    }
    showError(error);
  }
}

/**
 * Swap the action row for the receipt's countdown. "Keep open" exists because
 * the auto-close is a convenience, not a decision the user has to accept —
 * they may want to read the path before it goes.
 */
function startCountdown() {
  let remaining = Math.round(SPIKE_MS / 1000);
  actions.innerHTML =
    `<span class="countdown">Closing in <strong>${remaining}s</strong></span>` +
    `<button id="keep" class="secondary-btn" type="button">Keep open</button>`;

  const timer = setInterval(() => {
    remaining -= 1;
    const slot = actions.querySelector(".countdown strong");
    if (slot) slot.textContent = `${Math.max(0, remaining)}s`;
    if (remaining <= 0) {
      clearInterval(timer);
      window.close();
    }
  }, 1000);

  byId("keep")?.addEventListener("click", () => {
    clearInterval(timer);
    actions.innerHTML = `<span class="countdown">Saved · Esc to close</span>`;
  });
}

async function onFire() {
  if (!current) return;
  const btn = fireBtn();
  if (btn) btn.disabled = true;
  try {
    // Claim the ticket now, at the moment the artifact is actually written,
    // so The Pass numbers stay gapless across abandoned extractions.
    const fm = { ...current.fm, ticket: await nextTicket() };
    await fire(current.recipe, fm);

    // The recipe is on disk; the cached card would otherwise re-offer it
    // with a ticket number that has since been consumed.
    if (activeTabId !== null) await clearCache(activeTabId);

    // The card stays, dimmed, under the receipt — the user sees what was
    // written and where. The overlay is absolutely positioned, so pin the
    // card to the top first or a scrolled card hides it.
    card.scrollTop = 0;
    card.classList.add("fired");
    card.insertAdjacentHTML("beforeend", renderFired(filenameFor(current.recipe, fm)));
    startCountdown();
  } catch (error) {
    showError(error);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.close();
    return;
  }

  // Enter drives whichever primary the current state offers.
  if (event.key === "Enter") {
    const retry = byId<HTMLButtonElement>("retry");
    if (retry) {
      event.preventDefault();
      void run();
      return;
    }
    const btn = fireBtn();
    if (btn && !btn.disabled) {
      event.preventDefault();
      void onFire();
    }
    return;
  }

  // The error card's fallback list advertises P and ⌘C; honour them.
  if (byId("retry") || byId("copy")) {
    if (event.key === "p" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      chrome.runtime.openOptionsPage();
      return;
    }
    const copying = event.key === "c" && (event.metaKey || event.ctrlKey);
    // Never steal a real text selection from the user.
    if (copying && !window.getSelection()?.toString()) {
      event.preventDefault();
      void copyPageText();
    }
  }
});

bindActions();
void run();
