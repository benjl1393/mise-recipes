import type { Ticket, Units } from "./types";

const KEY_SETTINGS = "mise:settings";
const KEY_COUNTER = "mise:counter";
const KEY_PASS = "mise:pass";

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

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY_SETTINGS);
  return { ...DEFAULTS, ...(stored[KEY_SETTINGS] as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: next });
}

/** Device-local counter, incremented per capture. */
export async function nextTicket(): Promise<number> {
  const stored = await chrome.storage.local.get(KEY_COUNTER);
  const current = (stored[KEY_COUNTER] as number | undefined) ?? 0;
  const next = current >= MAX_TICKET ? 1 : current + 1;
  await chrome.storage.local.set({ [KEY_COUNTER]: next });
  return next;
}

/** The Pass — what's come across the pass, newest first. */
export async function listTickets(): Promise<Ticket[]> {
  const stored = await chrome.storage.local.get(KEY_PASS);
  return (stored[KEY_PASS] as Ticket[] | undefined) ?? [];
}

export async function saveTicket(ticket: Ticket): Promise<void> {
  const tickets = [ticket, ...(await listTickets())].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [KEY_PASS]: tickets });
}

export async function clearPass(): Promise<void> {
  await chrome.storage.local.set({ [KEY_PASS]: [] });
}
