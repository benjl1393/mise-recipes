import { describe, it, expect } from "vitest";
import { filterTickets } from "../src/lib/archive-filter";
import type { Ticket } from "../src/lib/types";

const make = (n: number, title: string, tags: string[], source: string): Ticket => ({
  frontmatter: { ticket: n, captured: "2026-04-22T16:28", source, via: "article text" },
  recipe: { title, serves: "4", ingredients: [{ qty: "1", item: "x" }], method: ["y"], tags },
});

const tickets = [
  make(3, "Kimchi Jjigae", ["#cuisine/korean", "#pork"], "https://maangchi.com/x"),
  make(2, "Cacio e Pepe", ["#cuisine/italian", "#grain"], "https://example.com/y"),
  make(1, "Pork Ragu", ["#cuisine/italian", "#pork"], "https://example.com/z"),
];

describe("filterTickets", () => {
  it("returns everything for an empty query", () => {
    expect(filterTickets(tickets, "")).toHaveLength(3);
    expect(filterTickets(tickets, "   ")).toHaveLength(3);
  });

  it("matches title case-insensitively", () => {
    expect(filterTickets(tickets, "kimchi").map((t) => t.frontmatter.ticket)).toEqual([3]);
  });

  it("matches tags", () => {
    expect(filterTickets(tickets, "#pork").map((t) => t.frontmatter.ticket)).toEqual([3, 1]);
    expect(filterTickets(tickets, "italian").map((t) => t.frontmatter.ticket)).toEqual([2, 1]);
  });

  it("matches the source domain", () => {
    expect(filterTickets(tickets, "maangchi").map((t) => t.frontmatter.ticket)).toEqual([3]);
  });

  it("matches a ticket number, padded or bare", () => {
    expect(filterTickets(tickets, "00002").map((t) => t.frontmatter.ticket)).toEqual([2]);
    expect(filterTickets(tickets, "2").map((t) => t.frontmatter.ticket)).toEqual([2]);
  });

  it("returns nothing when a query matches nothing", () => {
    expect(filterTickets(tickets, "sourdough")).toEqual([]);
  });

  it("preserves the newest-first order it was given", () => {
    expect(filterTickets(tickets, "cuisine").map((t) => t.frontmatter.ticket)).toEqual([3, 2, 1]);
  });
});
