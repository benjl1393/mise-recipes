import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import {
  getSettings,
  setSettings,
  nextTicket,
  saveTicket,
  listTickets,
  clearPass,
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
      units: "metric",
      model: "claude-haiku-4-5",
      captureFrames: true,
    });
  });

  it("merges a patch without clobbering other fields", async () => {
    await setSettings({ apiKey: "sk-ant-test" });
    await setSettings({ units: "imperial" });
    const settings = await getSettings();
    expect(settings.apiKey).toBe("sk-ant-test");
    expect(settings.units).toBe("imperial");
    expect(settings.model).toBe("claude-haiku-4-5");
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

describe("The Pass", () => {
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
    await clearPass();
    expect(await listTickets()).toEqual([]);
  });
});
