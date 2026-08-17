import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import { fire, filenameFor } from "../src/lib/fire";
import { listTickets } from "../src/lib/storage";
import type { Recipe, Frontmatter } from "../src/lib/types";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  serves: "4",
  ingredients: [{ qty: "800 g", item: "pork belly" }],
  method: ["Roast."],
  tags: ["#pork"],
};

const fm: Frontmatter = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://example.com/pork",
  via: "article text",
};

describe("filenameFor", () => {
  it("slugs the title and prefixes the ticket number", () => {
    expect(filenameFor(recipe, fm)).toBe("00427-gochujang-glazed-pork-belly.md");
  });

  it("strips characters that are illegal in filenames", () => {
    expect(filenameFor({ ...recipe, title: 'A/B "C": D?' }, fm)).toBe("00427-a-b-c-d.md");
  });

  it("truncates very long titles without leaving a trailing dash", () => {
    const name = filenameFor({ ...recipe, title: "word ".repeat(40) }, fm);
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.endsWith(".md")).toBe(true);
    expect(name).not.toContain("-.md");
  });

  it("falls back to the ticket number when the title slugs to nothing", () => {
    expect(filenameFor({ ...recipe, title: "!!!" }, fm)).toBe("00427.md");
  });
});

describe("fire", () => {
  let download: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeMock();
    download = vi.fn().mockResolvedValue(1);
    (globalThis as unknown as { chrome: { downloads: unknown } }).chrome.downloads = {
      download,
    };
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:mise"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "Blob",
      class {
        parts: unknown[];
        constructor(parts: unknown[]) {
          this.parts = parts;
        }
      },
    );
  });

  it("downloads the .md under the ticket filename", async () => {
    await fire(recipe, fm);
    expect(download).toHaveBeenCalledWith({
      url: "blob:mise",
      filename: "00427-gochujang-glazed-pork-belly.md",
      saveAs: false,
    });
  });

  it("records the ticket in The Pass", async () => {
    await fire(recipe, fm);
    const tickets = await listTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]!.frontmatter.ticket).toBe(427);
    expect(tickets[0]!.frontmatter.captured).toBe("2026-04-22T16:28");
    expect(tickets[0]!.recipe.title).toBe("Gochujang-Glazed Pork Belly");
  });

  it("revokes the object URL after handing it to chrome.downloads", async () => {
    await fire(recipe, fm);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mise");
  });

  it("still revokes the object URL when the download fails", async () => {
    download.mockRejectedValue(new Error("disk full"));
    await expect(fire(recipe, fm)).rejects.toThrow("disk full");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mise");
  });

  it("does not record a ticket when the download fails", async () => {
    download.mockRejectedValue(new Error("disk full"));
    await expect(fire(recipe, fm)).rejects.toThrow();
    expect(await listTickets()).toEqual([]);
  });
});
