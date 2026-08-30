import { createClient, extractRecipe, OffMenuError } from "../lib/anthropic";
import { clearCache, readCache, writeCache } from "../lib/cache";
import { captureFrames } from "../lib/frames";
import { fire, filenameFor } from "../lib/fire";
import { serializeRecipe } from "../lib/markdown";
import { getSettings, nextTicket, peekTicket } from "../lib/storage";
import type { ExtractionPayload } from "../lib/page-source";
import type { Frontmatter, Recipe, ViaMethod } from "../lib/types";
import { ACTIONS, errorActions, FIRED_ACTIONS, NAV, SUCCESS_ACTIONS } from "./actions";
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
import { mountPrep, submitPrep } from "./views/prep";
import { mountArchive } from "./views/archive";

const card = document.getElementById("card") as HTMLElement;
const prepView = document.getElementById("prep-view") as HTMLElement;
const archiveView = document.getElementById("archive-view") as HTMLElement;
const actions = document.getElementById("actions") as HTMLElement;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const fireBtn = () => byId<HTMLButtonElement>("fire");

type View = keyof typeof ACTIONS;

/**
 * How long the FIRED receipt sits before the popup closes behind it.
 * The specimen's fired state advertises "Closing in 2s".
 */
const SPIKE_MS = 2000;

let view: View = "extract";
/**
 * The extract view's action row as it stood when we left it. Prep and Archive
 * are detours, not new pages: coming back must restore whatever state the
 * card was in — a filled card, an error row, or the fired receipt — and must
 * never re-run extraction, which would cost another billed call.
 */
let extractActions: string = ACTIONS.extract;

let current: { recipe: Recipe; fm: Frontmatter } | null = null;
let activeTabId: number | null = null;
let activeTabUrl = "";

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

/** Install the extract view's action row, remembering it for the trip back. */
function setExtractActions(html: string) {
  extractActions = html;
  if (view === "extract") {
    actions.innerHTML = html;
    bindActions();
  }
}

function showView(next: View) {
  // Reaching for Prep or the Archive is itself the decision to stay, so it
  // cancels the auto-close. Without this the window would shut mid-Prep, and
  // the row restored on the way back would still be the countdown.
  if (countdownTimer !== null && next !== "extract") cancelCountdown();

  view = next;
  card.hidden = next !== "extract";
  prepView.hidden = next !== "prep";
  archiveView.hidden = next !== "archive";

  actions.innerHTML = next === "extract" ? extractActions : ACTIONS[next];
  bindActions();

  // Mounted fresh each time so the Archive reflects a recipe fired moments
  // ago, and Prep reloads settings that may have changed.
  if (next === "prep") mountPrep(prepView);
  if (next === "archive") mountArchive(archiveView);
}

/** Wire whichever action row is currently mounted. */
function bindActions() {
  fireBtn()?.addEventListener("click", () => void onFire());
  byId("prep")?.addEventListener("click", () => showView("prep"));
  byId("archive")?.addEventListener("click", () => showView("archive"));
  byId("back")?.addEventListener("click", () => showView("extract"));
  byId("save")?.addEventListener("click", () => submitPrep(prepView));
  byId("retry")?.addEventListener("click", () => void run());
  byId("copy")?.addEventListener("click", () => void copyMarkdown());
}

function showStamp(kind: "error" | "offmenu", detail?: string, hint?: string) {
  settle();
  card.innerHTML = renderStamp(kind, detail, hint);
  setExtractActions(ACTIONS.extract);
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
  fallbacks.push({ glyph: "→", text: "Open Prep to change key or model", key: "P" });

  card.innerHTML = renderError(failure, { url: activeTabUrl, fallbacks });

  setExtractActions(errorActions(failure.canRetry));

  (byId("retry") ?? byId("prep"))?.focus();
}

/**
 * Copy the finished .md — the same bytes Fire would write — so the artifact can
 * go straight into Notes, Obsidian or anywhere else. Distinct from the raw page
 * text the error row used to offer: this is the product's actual output.
 *
 * The ticket is the peeked one, not a claimed one. Copying must not burn a
 * number, so a copy-then-fire writes the same ticket the copy showed, and a
 * copy-then-abandon leaves the counter untouched.
 */
async function copyMarkdown() {
  if (!current) return;
  const btn = byId("copy");
  try {
    await navigator.clipboard.writeText(serializeRecipe(current.recipe, current.fm));
    if (btn) btn.textContent = "Copied";
  } catch {
    // Clipboard can be refused; say so rather than silently doing nothing.
    if (btn) btn.textContent = "Can't copy";
  }
  if (btn) window.setTimeout(() => { btn.textContent = "Copy"; }, 1600);
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
  setExtractActions(SUCCESS_ACTIONS);
  const btn = fireBtn();
  if (btn) {
    btn.disabled = false;
    if (view === "extract") btn.focus();
  }
}

async function run() {
  showView("extract");
  setExtractActions(ACTIONS.extract);
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
      showStamp(
        "offmenu",
        "Nothing to cook here.",
        "Mise found no recipe on this page. Try a recipe blog, a Reel, or a video.",
      );
      return;
    }
    showError(error);
  }
}

let countdownTimer: number | null = null;

function cancelCountdown() {
  if (countdownTimer !== null) clearInterval(countdownTimer);
  countdownTimer = null;
  setExtractActions(FIRED_ACTIONS);
}

/**
 * Swap the action row for the receipt's countdown. The auto-close preserves the
 * fire-and-leave gesture, but Prep and Archive ride alongside it — reaching for
 * either is itself the decision to stay, so it cancels the close rather than
 * needing a separate "Keep open".
 */
function startCountdown() {
  let remaining = Math.round(SPIKE_MS / 1000);
  setExtractActions(
    `<span class="countdown">Closing in <strong>${remaining}s</strong></span>` + NAV,
  );

  countdownTimer = setInterval(() => {
    remaining -= 1;
    const slot = actions.querySelector(".countdown strong");
    if (slot) slot.textContent = `${Math.max(0, remaining)}s`;
    if (remaining <= 0) {
      if (countdownTimer !== null) clearInterval(countdownTimer);
      countdownTimer = null;
      window.close();
    }
  }, 1000) as unknown as number;
}

async function onFire() {
  if (!current) return;
  const btn = fireBtn();
  if (btn) btn.disabled = true;
  try {
    // Claim the ticket now, at the moment the artifact is actually written,
    // so Archive numbers stay gapless across abandoned extractions.
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
    // Esc backs out of a detour before it closes the window.
    if (view !== "extract") {
      showView("extract");
      return;
    }
    window.close();
    return;
  }

  if (event.key === "Enter") {
    if (view === "prep") {
      event.preventDefault();
      submitPrep(prepView);
      return;
    }
    if (view === "archive") return;

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

  if (view !== "extract") return;

  // The error card's fallback list advertises P; honour it. Keyed off the card
  // itself, not off the Retry button — an unretryable failure (a rejected key)
  // has no Retry but still lists the shortcut.
  if (card.querySelector(".callout.error")) {
    if (event.key === "p" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      showView("prep");
    }
  }
});

showView("extract");
void run();
