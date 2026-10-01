import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import {
  getSettings,
  setSettings,
  nextTicket,
  peekTicket,
  saveTicket,
  listTickets,
  clearArchive,
} from "../src/lib/storage";
import type { Ticket } from "../src/lib/types";

const ticket = (n: number): Ticket => ({
  frontmatter: {
    ticket: n,
    captured: "2026-04-22T16:28",
    source: "https://example.com",
    via: "article text",
  },
  recipe: {
    title: `Recipe ${n}`,
    serves: "4",
    ingredients: [{ qty: "1", item: "thing" }],
    method: ["do it"],
    tags: ["#pork"],
  },
});

beforeEach(() => {
  vi.unstubAllGlobals();
  installChromeMock();
});

describe("settings", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual({
      apiKey: "",
      provider: "anthropic",
      tier: "fast",
      baseURL: "",
      customModel: "",
      units: "metric",
      captureFrames: true,
      // On by default: the detector only fires on a declared schema.org/Recipe,
      // so the feature is quiet on everything else and does not need opting in.
      pulseOnDetect: true,
    });
  });

  it("merges a patch without clobbering other fields", async () => {
    await setSettings({ apiKey: "sk-ant-test" });
    await setSettings({ units: "imperial" });
    const settings = await getSettings();
    expect(settings.apiKey).toBe("sk-ant-test");
    expect(settings.units).toBe("imperial");
    expect(settings.tier).toBe("fast");
  });
});

describe("settings migration", () => {
  it.each([
    ["claude-haiku-4-5", "fast"],
    ["claude-opus-5", "thorough"],
  ])("reads a stored model %s as Anthropic + %s", async (model, tier) => {
    installChromeMock({ "mise:settings": { apiKey: "sk-ant-x", model, units: "imperial" } });
    const s = await getSettings();
    expect(s.provider).toBe("anthropic");
    expect(s.tier).toBe(tier);
    expect(s.units).toBe("imperial");
    expect(s).not.toHaveProperty("model");
  });

  it("writes the new shape on the next save, with no model key", async () => {
    const local = installChromeMock({
      "mise:settings": { apiKey: "sk-ant-x", model: "claude-opus-5" },
    });
    await setSettings({ units: "imperial" });
    const stored = local["mise:settings"] as Record<string, unknown>;
    expect(stored).not.toHaveProperty("model");
    expect(stored.tier).toBe("thorough");
  });

  it("never overrides a stored provider", async () => {
    installChromeMock({
      "mise:settings": { apiKey: "sk-x", provider: "openai", tier: "fast", model: "claude-opus-5" },
    });
    const s = await getSettings();
    expect(s.provider).toBe("openai");
    expect(s.tier).toBe("fast");
  });
});

describe("settings sanitising", () => {
  // A preset removed in a later version, or a hand-edited store, must not
  // reach Prep's menu or the adapters as an id nothing recognises.
  it("falls back to Anthropic and Fast for ids it does not know", async () => {
    installChromeMock({ "mise:settings": { apiKey: "k", provider: "groq", tier: "turbo" } });
    const s = await getSettings();
    expect(s.provider).toBe("anthropic");
    expect(s.tier).toBe("fast");
  });
});

describe("dev key seed", () => {
  it("lets the provider follow the seeded key", async () => {
    vi.stubGlobal("__MISE_DEV_KEY__", "sk-proj-seeded");
    installChromeMock({ "mise:settings": { model: "claude-haiku-4-5" } });
    const s = await getSettings();
    expect(s.apiKey).toBe("sk-proj-seeded");
    expect(s.provider).toBe("openai");
  });

  it("never seeds a Custom provider, which may be keyless on purpose", async () => {
    vi.stubGlobal("__MISE_DEV_KEY__", "sk-ant-seeded");
    installChromeMock({
      "mise:settings": {
        provider: "custom",
        baseURL: "http://localhost:11434/v1",
        customModel: "m",
      },
    });
    const s = await getSettings();
    expect(s.apiKey).toBe("");
    expect(s.provider).toBe("custom");
  });
});

describe("peekTicket", () => {
  // The bug this guards: the card shows its ticket number before the user
  // fires, so display used to call nextTicket() and permanently consume a
  // number on every popup open — including the re-opens caused by a tab
  // switch. Peeking must be free.
  it("reports the next number without consuming it", async () => {
    expect(await peekTicket()).toBe(1);
    expect(await peekTicket()).toBe(1);
    expect(await peekTicket()).toBe(1);
    expect(await nextTicket()).toBe(1);
    expect(await peekTicket()).toBe(2);
  });

  it("agrees with nextTicket across the rollover boundary", async () => {
    await chrome.storage.local.set({ "mise:counter": 99999 });
    expect(await peekTicket()).toBe(1);
    expect(await nextTicket()).toBe(1);
  });
});

describe("nextTicket", () => {
  it("starts at 1 and increments monotonically", async () => {
    expect(await nextTicket()).toBe(1);
    expect(await nextTicket()).toBe(2);
    expect(await nextTicket()).toBe(3);
  });

  it("wraps back to 1 after 99999", async () => {
    installChromeMock({ "mise:counter": 99999 });
    expect(await nextTicket()).toBe(1);
  });
});

describe("the Archive", () => {
  it("returns an empty list before anything is fired", async () => {
    expect(await listTickets()).toEqual([]);
  });

  it("stores newest first", async () => {
    await saveTicket(ticket(1));
    await saveTicket(ticket(2));
    const tickets = await listTickets();
    expect(tickets.map((t) => t.frontmatter.ticket)).toEqual([2, 1]);
  });

  it("caps history at 500 entries, dropping the oldest", async () => {
    for (let i = 1; i <= 505; i++) await saveTicket(ticket(i));
    const tickets = await listTickets();
    expect(tickets).toHaveLength(500);
    expect(tickets[0]!.frontmatter.ticket).toBe(505);
    expect(tickets.at(-1)!.frontmatter.ticket).toBe(6);
  });

  it("clears", async () => {
    await saveTicket(ticket(1));
    await clearArchive();
    expect(await listTickets()).toEqual([]);
  });
});

/**
 * "The Pass" became "Archive" on 2026-08-17, which moved the storage key.
 * Anything already fired has to survive that — the whole product promise is
 * that these artifacts persist.
 */
describe("archive migration from mise:pass", () => {
  it("reads a legacy archive when the new key is absent", async () => {
    installChromeMock({ "mise:pass": [ticket(2), ticket(1)] });
    const tickets = await listTickets();
    expect(tickets).toHaveLength(2);
    expect(tickets[0]!.frontmatter.ticket).toBe(2);
  });

  it("rewrites legacy entries under the new key on the next save", async () => {
    const store = installChromeMock({ "mise:pass": [ticket(1)] });
    await saveTicket(ticket(2));
    expect((store["mise:archive"] as unknown[]).length).toBe(2);
    expect(await listTickets()).toHaveLength(2);
  });

  it("prefers the new key once it exists", async () => {
    installChromeMock({ "mise:pass": [ticket(9)], "mise:archive": [ticket(1)] });
    const tickets = await listTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]!.frontmatter.ticket).toBe(1);
  });

  // Without dropping the legacy key, a cleared archive would come back.
  it("does not resurrect the legacy archive after clearing", async () => {
    installChromeMock({ "mise:pass": [ticket(1), ticket(2)] });
    await clearArchive();
    expect(await listTickets()).toEqual([]);
  });
});
