import { iconFrame } from "../lib/mark";
import { HOST_ACCESS, HOST_MATCHES } from "../lib/host-access";

const MENU_ID = "mise-fire-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Fire selected text to Mise",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.selectionText) return;
  // Stash the selection so the popup extracts from it instead of the whole page.
  await chrome.storage.local.set({
    "mise:selection": {
      text: info.selectionText,
      source: tab.url ?? "",
      tabId: tab.id,
      at: Date.now(),
    },
  });
  await chrome.action.openPopup();
});

// ---------------------------------------------------------------------------
// Recipe detection → toolbar pulse
// ---------------------------------------------------------------------------

const DETECTOR_ID = "mise-detect";

const DEFAULT_ICON = { 16: "icons/mise-icon-16.png", 32: "icons/mise-icon-32.png" };
const DEFAULT_TITLE = "Fire this recipe to Mise";
const ARMED_TITLE = "Recipe found — fire it to Mise";

/**
 * The pulse, as discrete heat steps rather than a smooth fade.
 *
 * The motion spec's signature is "smooth container, mechanical contents":
 * surfaces ease, textural detail moves in steps like a print head. A toolbar
 * icon flashing for attention is textural, and the colour system explicitly
 * derives flame from "digital clock red digits" — so this ramps like a
 * seven-segment LED coming up to heat, not like a breathing dot.
 */
const PULSE_RAMP = [0, 0.34, 0.67, 1, 0.67, 0.34];
const FRAME_MS = 90;
const PULSE_CYCLES = 3;

/**
 * Which tabs are showing a recipe, and which pulse generation owns each one.
 *
 * The generation counter is global and only ever increments. Per-tab counters
 * would let a cancelled loop and a freshly started one land on the same number
 * and both believe they are current.
 */
const armed = new Map<number, number>();
let generationCounter = 0;

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

async function paint(tabId: number, heat: number): Promise<boolean> {
  try {
    await chrome.action.setIcon({ tabId, imageData: iconFrame(heat) });
    return true;
  } catch {
    // Tab closed or navigated mid-animation. Drop it so the loop bails out.
    armed.delete(tabId);
    return false;
  }
}

/**
 * Pulse three times, then hold at full flame for as long as the tab is on the
 * recipe.
 *
 * Finite on purpose, twice over. An icon that pulses forever is a nag rather
 * than a signal — and an MV3 worker is only reliably alive for a short window
 * after the event that woke it, so an endless animation would die raggedly at
 * whatever frame Chrome chose. Settling into a steady state means the useful
 * information ("Mise can fire this page") survives the worker being suspended.
 */
async function pulse(tabId: number): Promise<void> {
  const generation = ++generationCounter;
  armed.set(tabId, generation);
  const current = (): boolean => armed.get(tabId) === generation;

  void chrome.action.setTitle({ tabId, title: ARMED_TITLE }).catch(() => {});

  for (let cycle = 0; cycle < PULSE_CYCLES; cycle++) {
    for (const heat of PULSE_RAMP) {
      if (!current() || !(await paint(tabId, heat))) return;
      await sleep(FRAME_MS);
    }
  }
  if (current()) await paint(tabId, 1);
}

/**
 * Chrome already resets tab-scoped icons on navigation, but it knows nothing
 * about the animation loop — without this, a pulse started on the old page
 * keeps repainting the new one.
 */
function disarm(tabId: number): void {
  if (!armed.delete(tabId)) return;
  void chrome.action.setIcon({ tabId, path: DEFAULT_ICON }).catch(() => {});
  void chrome.action.setTitle({ tabId, title: DEFAULT_TITLE }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "mise:recipe-detected" && sender.tab?.id !== undefined) {
    void pulse(sender.tab.id);
  }
  return false; // nothing here answers asynchronously
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") disarm(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  armed.delete(tabId);
});

// ---------------------------------------------------------------------------
// Detector registration
// ---------------------------------------------------------------------------

/**
 * Seeing every page requires broad host access, which Mise keeps *optional* so a
 * plain install asks for nothing and the extraction path keeps working on
 * `activeTab` alone. The pulse is therefore a progressive enhancement: register
 * the detector when the user grants the permission, tear it down if they take
 * it back.
 */
export async function syncDetector(): Promise<void> {
  try {
    const granted = await chrome.permissions.contains(HOST_ACCESS);
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [DETECTOR_ID] });
    if (granted && registered.length === 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: DETECTOR_ID,
          js: ["content/detect.js"],
          matches: [...HOST_MATCHES],
          runAt: "document_idle",
          allFrames: false,
        },
      ]);
      console.info("[mise] recipe detector registered");
    } else if (!granted && registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [DETECTOR_ID] });
      console.info("[mise] recipe detector unregistered");
    } else {
      console.info(
        `[mise] detector unchanged — host access ${granted ? "granted" : "NOT granted"}, ` +
          `${registered.length} script(s) registered`,
      );
    }
  } catch (error) {
    // Registration is best-effort: a failure costs the pulse, never extraction.
    // But it must not be silent — a detector that never registers looks
    // identical to a feature that does not work, and the service-worker
    // console is the only place that difference is visible.
    console.warn("[mise] detector registration failed:", error);
  }
}

chrome.runtime.onInstalled.addListener(() => void syncDetector());
chrome.runtime.onStartup.addListener(() => void syncDetector());
chrome.permissions.onAdded.addListener(() => void syncDetector());
chrome.permissions.onRemoved.addListener(() => void syncDetector());

/**
 * And once on every wake, not only on those four events.
 *
 * Host access can also be granted outside this extension entirely — Chrome's
 * "Site access" menu, and whatever equivalent a Chromium fork ships. Those do
 * not reliably fire `permissions.onAdded`, and when they don't, the detector
 * is never registered: the permission reads as granted, the toggle looks on,
 * and nothing pulses, with no error anywhere to explain it. That was a real
 * report, on Dia.
 *
 * An MV3 worker re-runs its top level every time it wakes, and this worker is
 * woken by tab updates already, so this makes registration self-healing rather
 * than dependent on a single event firing.
 */
void syncDetector();
