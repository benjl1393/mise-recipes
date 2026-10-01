import type { Ticket, Units } from "./types";
import { detectProvider, type ProviderId, type Tier } from "./providers/presets";

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
  provider: ProviderId;
  tier: Tier;
  /** Custom only. Kept when another provider is chosen, so switching back loses nothing. */
  baseURL: string;
  /** Custom only. */
  customModel: string;
  units: Units;
  captureFrames: boolean;
  /** Whether a detected recipe pulses the toolbar icon. */
  pulseOnDetect: boolean;
}

const DEFAULTS: Settings = {
  apiKey: "",
  provider: "anthropic",
  tier: "fast",
  baseURL: "",
  customModel: "",
  units: "metric",
  captureFrames: true,
  pulseOnDetect: true,
};

/** Settings before 2026-10-01 stored a model ID instead of provider + tier. */
type StoredSettings = Partial<Settings> & { model?: unknown };

/**
 * Decided on the raw stored object: after DEFAULTS are merged, provider and
 * tier always exist and "nothing stored" can no longer be told apart.
 */
function migrate(raw: StoredSettings): Partial<Settings> {
  const { model, ...rest } = raw;
  if (rest.provider === undefined && typeof model === "string") {
    return {
      ...rest,
      provider: "anthropic",
      tier: rest.tier ?? (model.includes("opus") ? "thorough" : "fast"),
    };
  }
  return rest;
}

/**
 * Injected by build.mjs. Empty string in any build without --dev, so this is
 * dead weight in a release bundle rather than a leaked credential.
 */
declare const __MISE_DEV_KEY__: string;

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY_SETTINGS);
  const raw = (stored[KEY_SETTINGS] as StoredSettings | undefined) ?? {};
  const settings: Settings = { ...DEFAULTS, ...migrate(raw) };
  // Seed a dev key only when nothing is stored — never override a real one the
  // user typed, so a --dev build behaves normally once Prep has been saved.
  // The typeof guard matters: this is a build-time define, so the identifier
  // simply does not exist under vitest, and a bare reference would throw.
  // The provider follows the seeded key, so a migrated "anthropic" can never
  // sit beside a seeded OpenAI key. Custom may be keyless on purpose.
  const seed = typeof __MISE_DEV_KEY__ === "string" ? __MISE_DEV_KEY__ : "";
  if (!settings.apiKey && seed && settings.provider !== "custom") {
    settings.apiKey = seed;
    settings.provider = detectProvider(seed) ?? settings.provider;
  }
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
