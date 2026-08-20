import { hasRecipe } from "../lib/detect-recipe";
import { getSettings } from "../lib/storage";

/**
 * Tell the service worker when the page declares itself a recipe, so the
 * toolbar icon can pulse.
 *
 * Registered dynamically rather than declared in the manifest: seeing every
 * page needs `<all_urls>`, which stays an *optional* permission so a plain
 * install still asks for nothing. The worker registers this script the moment
 * the user grants it and unregisters it if they revoke — see
 * `syncDetector` in background/service-worker.ts.
 */

/** How long to keep watching for JSON-LD that arrives after first paint. */
const LATE_INJECTION_WINDOW_MS = 10_000;

let announced = false;

function announce(): boolean {
  if (announced || !hasRecipe(document)) return false;
  announced = true;
  // The worker may be asleep; this wakes it. Nothing needs the reply.
  void chrome.runtime.sendMessage({ type: "mise:recipe-detected" }).catch(() => {
    // Worker torn down mid-send, or the extension was just reloaded. The next
    // navigation re-runs this script, so there is nothing useful to do here.
  });
  return true;
}

async function start(): Promise<void> {
  // The script is declared in the manifest, so it runs on every page. The
  // toggle is now a stored setting rather than a permission, which means the
  // off switch has to be honoured here — bail before doing any work.
  const { pulseOnDetect } = await getSettings();
  if (!pulseOnDetect) return;

  if (announce()) return;

  // Recipe sites are overwhelmingly server-rendered, but a handful of SPA food
  // apps mount their JSON-LD after hydration. Watch briefly, then stop — a
  // permanent observer on every page the user visits is not a fair trade for
  // the last few percent of coverage.
  const observer = new MutationObserver(() => {
    if (announce()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), LATE_INJECTION_WINDOW_MS);
}

void start();
