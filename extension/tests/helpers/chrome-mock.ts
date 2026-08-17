import { vi } from "vitest";

/** Minimal in-memory chrome.storage.local, installed on globalThis. */
export function installChromeMock(seed: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...seed };
  const local = {
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
  vi.stubGlobal("chrome", { storage: { local } });
  return store;
}
