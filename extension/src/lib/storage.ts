import type { Ticket, Units } from "./types";

const KEY_SETTINGS = "mise:settings";
const KEY_COUNTER = "mise:counter";
const KEY_ARCHIVE = "mise:archive";

/**
 * Pre-rename key. "The Pass" became "Archive" on 2026-08-17 — read the old
 * key once so anything already fired survives the rename rather than
 * silently disappearing.
 */
const KEY_LEGACY_PASS = "mise:pass";

/** Tickets are 5-digit; roll over rather than overflow the format. */
const MAX_TICKET = 99999;

/** chrome.storage.local gives ~10MB per origin. 500 tickets stays well inside it. */
const MAX_HISTORY = 500;

export interface Settings {
  apiKey: string;
  units: Units;
  model: string;
  captureFrames: boolean;
}

const DEFAULTS: Settings = {
  apiKey: "",
  units: "metric",
  model: "claude-haiku-4-5",
  captureFrames: true,
};

/**
 * Injected by build.mjs. Empty string in any build without --dev, so this is
 * dead weight in a release bundle rather than a leaked credential.
 */
declare const __MISE_DEV_KEY__: string;

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY_SETTINGS);
  const settings = { ...DEFAULTS, ...(stored[KEY_SETTINGS] as Partial<Settings> | undefined) };
  // Seed a dev key only when nothing is stored — never override a real one the
  // user typed, so a --dev build behaves normally once Prep has been saved.
  // The typeof guard matters: this is a build-time define, so the identifier
  // simply does not exist under vitest, and a bare reference would throw.
  const seed = typeof __MISE_DEV_KEY__ === "string" ? __MISE_DEV_KEY__ : "";
  if (!settings.apiKey && seed) settings.apiKey = seed;
  return settings;
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: next });
}

/**
 * What the next ticket *would* be, without claiming it.
 *
 * The filled card shows its ticket number before the user fires, but an
 * extraction the user abandons must not consume one — otherwise re-opening
 * the popup on the same page (or any tab switch) leaves permanent gaps in
 * the Archive. Display peeks; only fire() commits.
 */
export async function peekTicket(): Promise<number> {
  const stored = await chrome.storage.local.get(KEY_COUNTER);
  const current = (stored[KEY_COUNTER] as number | undefined) ?? 0;
  return current >= MAX_TICKET ? 1 : current + 1;
}

/** Device-local counter, incremented per capture. */
export async function nextTicket(): Promise<number> {
  const stored = await chrome.storage.local.get(KEY_COUNTER);
  const current = (stored[KEY_COUNTER] as number | undefined) ?? 0;
  const next = current >= MAX_TICKET ? 1 : current + 1;
  await chrome.storage.local.set({ [KEY_COUNTER]: next });
  return next;
}

/** The Archive — every recipe fired from this device, newest first. */
export async function listTickets(): Promise<Ticket[]> {
  const stored = await chrome.storage.local.get([KEY_ARCHIVE, KEY_LEGACY_PASS]);
  const current = stored[KEY_ARCHIVE] as Ticket[] | undefined;
  if (current) return current;
  return (stored[KEY_LEGACY_PASS] as Ticket[] | undefined) ?? [];
}

export async function saveTicket(ticket: Ticket): Promise<void> {
  // Reading through listTickets is what carries a legacy archive forward: the
  // first save after the rename rewrites the whole list under the new key.
  const tickets = [ticket, ...(await listTickets())].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [KEY_ARCHIVE]: tickets });
}

export async function clearArchive(): Promise<void> {
  await chrome.storage.local.set({ [KEY_ARCHIVE]: [] });
  // Drop the legacy key too, or a cleared archive would resurrect from it.
  await chrome.storage.local.remove(KEY_LEGACY_PASS);
}
