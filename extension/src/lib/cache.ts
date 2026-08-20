import type { Frontmatter, Recipe } from "./types";

/**
 * Extraction cache, keyed by tab.
 *
 * An MV3 popup is a document Chrome destroys the moment it loses focus —
 * switching tabs, clicking the page, or opening another window all tear it
 * down. Without a cache, re-opening the popup re-runs the whole pipeline:
 * another content-script injection, another frame capture, and another
 * *billed* Anthropic call for a recipe we already have.
 *
 * chrome.storage.session is the right home: in-memory, wiped on browser
 * restart, and never written to disk — extraction results are derived data,
 * not artifacts. The artifact is the .md the user fires.
 */

const KEY = "mise:extraction-cache";

/** Guard against a card so old the page has almost certainly moved on. */
const TTL_MS = 60 * 60 * 1000;

/**
 * How many tabs to remember. Session storage is capped (~10MB) and a recipe
 * card is a few KB, so this is about bounding growth, not fitting.
 */
const MAX_ENTRIES = 20;

interface CachedExtraction {
  /** Guards against the tab navigating: same tab id, different page. */
  url: string;
  recipe: Recipe;
  /** Frontmatter with `captured` flattened to ISO — Date does not survive JSON. */
  fm: Omit<Frontmatter, "captured"> & { captured: string };
  at: number;
}

type CacheMap = Record<string, CachedExtraction>;

/**
 * chrome.storage.session is absent in older runtimes and in unit tests that
 * only stub storage.local, so every path degrades to "no cache" rather than
 * throwing inside popup startup.
 */
function session(): chrome.storage.StorageArea | null {
  return chrome.storage?.session ?? null;
}

async function readAll(): Promise<CacheMap> {
  const area = session();
  if (!area) return {};
  try {
    const stored = await area.get(KEY);
    return (stored[KEY] as CacheMap | undefined) ?? {};
  } catch {
    return {};
  }
}

export async function readCache(
  tabId: number,
  url: string,
): Promise<{ recipe: Recipe; fm: Frontmatter } | null> {
  const entry = (await readAll())[String(tabId)];
  if (!entry) return null;
  // A navigated tab must re-extract; a stale one must not resurface.
  if (entry.url !== url || Date.now() - entry.at > TTL_MS) return null;
  return { recipe: entry.recipe, fm: { ...entry.fm, captured: new Date(entry.fm.captured) } };
}

export async function writeCache(
  tabId: number,
  url: string,
  recipe: Recipe,
  fm: Frontmatter,
): Promise<void> {
  const area = session();
  if (!area) return;
  const all = await readAll();
  all[String(tabId)] = {
    url,
    recipe,
    fm: { ...fm, captured: fm.captured.toISOString() },
    at: Date.now(),
  };

  // Evict oldest first so a long browsing session cannot grow without bound.
  const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at);
  const kept = Object.fromEntries(entries.slice(0, MAX_ENTRIES));

  try {
    await area.set({ [KEY]: kept });
  } catch {
    // A full or unavailable session area costs a re-extract, not a crash.
  }
}

/** Drop a tab's entry once its recipe has been fired and written to disk. */
export async function clearCache(tabId: number): Promise<void> {
  const area = session();
  if (!area) return;
  const all = await readAll();
  if (!(String(tabId) in all)) return;
  delete all[String(tabId)];
  try {
    await area.set({ [KEY]: all });
  } catch {
    // Non-fatal: a stale entry expires on its own.
  }
}
