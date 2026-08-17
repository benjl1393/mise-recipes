import { createClient, extractRecipe, OffMenuError } from "../lib/anthropic";
import { captureFrames } from "../lib/frames";
import { fire } from "../lib/fire";
import { getSettings, nextTicket } from "../lib/storage";
import type { ExtractionPayload } from "../lib/page-source";
import type { Frontmatter, Recipe, ViaMethod } from "../lib/types";
import { renderCard, renderFired, renderSkeleton, renderStamp } from "./render";
import { filenameFor } from "../lib/fire";

const card = document.getElementById("card") as HTMLElement;
const fireBtn = document.getElementById("fire") as HTMLButtonElement;
const prepBtn = document.getElementById("prep") as HTMLButtonElement;
const passBtn = document.getElementById("pass") as HTMLButtonElement;

/**
 * How long the FIRED receipt sits before the popup closes behind it.
 * The specimen's fired state advertises "Closing in 2s".
 */
const SPIKE_MS = 2000;

let current: { recipe: Recipe; fm: Frontmatter } | null = null;

interface ExtractReply {
  ok: boolean;
  error?: string;
  payload: ExtractionPayload;
  videoRect: { x: number; y: number; width: number; height: number } | null;
  devicePixelRatio: number;
}

function showStamp(kind: "error" | "offmenu", detail?: string) {
  card.setAttribute("aria-busy", "false");
  card.innerHTML = renderStamp(kind, detail);
  // Colour v2.2 wants red contextually exclusive — action OR failure per
  // screen. Disabling Fire already drops it to neutral ink, so a stamped
  // card never shows two reds.
  fireBtn.disabled = true;
}

function showSkeleton(phase: string) {
  card.setAttribute("aria-busy", "true");
  card.innerHTML = renderSkeleton(phase);
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

async function run() {
  showSkeleton("reading");

  const settings = await getSettings();
  if (!settings.apiKey) {
    showStamp("error", "No API key yet. Open Prep to add one.");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showStamp("error", "No active tab.");
    return;
  }

  try {
    const selection = await takeSelection(tab.id);
    const reply = selection ? null : await askContentScript(tab.id);
    const payload = selection ?? reply!.payload;

    let frames: string[] = [];
    if (reply && payload.hasVideo && settings.captureFrames) {
      const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
      if (granted) {
        showSkeleton("capturing");
        frames = await captureFrames(tab.id, {
          crop: reply.videoRect,
          devicePixelRatio: reply.devicePixelRatio,
        });
        if (frames.length > 0) {
          payload.via = `${frames.length} video frames` as ViaMethod;
        }
      }
    }

    showSkeleton("extracting");
    const recipe = await extractRecipe(payload, {
      client: createClient(settings.apiKey),
      units: settings.units,
      model: settings.model,
      frames,
    });

    const fm: Frontmatter = {
      ticket: await nextTicket(),
      captured: new Date(),
      source: payload.source,
      via: payload.via,
      // Only recorded when the user overrode the default (docs/mise-md-format.md).
      units: settings.units === "metric" ? undefined : settings.units,
    };

    current = { recipe, fm };
    card.innerHTML = renderCard(recipe, fm);
    card.setAttribute("aria-busy", "false");
    fireBtn.disabled = false;
    fireBtn.focus();
  } catch (error) {
    if (error instanceof OffMenuError) {
      showStamp("offmenu", "Nothing to extract here.");
    } else {
      showStamp("error", (error as Error).message);
    }
  }
}

async function onFire() {
  if (!current) return;
  fireBtn.disabled = true;
  try {
    await fire(current.recipe, current.fm);
    // The card stays, dimmed, under the receipt — the user sees what was
    // written and where. The overlay is absolutely positioned, so pin the
    // card to the top first or a scrolled card hides it.
    card.scrollTop = 0;
    card.classList.add("fired");
    card.insertAdjacentHTML("beforeend", renderFired(filenameFor(current.recipe, current.fm)));
    setTimeout(() => window.close(), SPIKE_MS);
  } catch (error) {
    showStamp("error", (error as Error).message);
  }
}

fireBtn.addEventListener("click", () => void onFire());
prepBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
passBtn.addEventListener("click", () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("pass/pass.html") }),
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !fireBtn.disabled) {
    event.preventDefault();
    void onFire();
  }
  if (event.key === "Escape") window.close();
});

void run();
