import { vi } from "vitest";

/** One in-memory storage area with the subset of the API the extension uses. */
function makeArea(store: Record<string, unknown>) {
  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys == null) return { ...store };
      if (typeof keys === "string") return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((k) => [k, store[k]]));
      }
      return Object.fromEntries(
        Object.entries(keys).map(([k, fallback]) => [k, store[k] ?? fallback]),
      );
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store, items);
    },
    async remove(key: string) {
      delete store[key];
    },
  };
}

export interface ChromeMockOptions {
  /**
   * Omit chrome.storage.session to stand in for a runtime that lacks it —
   * the extraction cache has to degrade to "no cache", not throw.
   */
  withSession?: boolean;
}

/**
 * Minimal in-memory chrome.storage, installed on globalThis.
 * Returns the `local` store so tests can assert on persisted state directly.
 */
export function installChromeMock(
  seed: Record<string, unknown> = {},
  options: ChromeMockOptions = {},
) {
  const store: Record<string, unknown> = { ...seed };
  const sessionStore: Record<string, unknown> = {};
  const storage: Record<string, unknown> = { local: makeArea(store) };
  if (options.withSession !== false) storage.session = makeArea(sessionStore);
  vi.stubGlobal("chrome", { storage });
  return store;
}
