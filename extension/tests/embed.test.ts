// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE_AFTER_S, IN_THE_EXTENSION, mountEmbed, REPLAY_MS, type EmbedOptions } from "../src/embed/embed";
import { FIRST_TICKET, FIXTURE_RECIPE, fixtureFrontmatter } from "../src/embed/fixture";
import { filenameFor } from "../src/lib/fire";
import { serializeRecipe } from "../src/lib/markdown";

const NOW = new Date("2026-10-01T18:03:00+02:00");

function setup(opts: EmbedOptions = {}) {
  document.body.innerHTML = `<main class="popup" id="card"></main><div class="popup-actions" id="actions"></div>`;
  const downloads: Array<{ markdown: string; filename: string }> = [];
  const embed = mountEmbed(document, {
    now: () => NOW,
    download: (markdown, filename) => downloads.push({ markdown, filename }),
    ...opts,
  });
  const card = document.getElementById("card")!;
  const actions = document.getElementById("actions")!;
  return { embed, downloads, card, actions };
}

const enter = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
const landed = () => { const s = setup(); s.embed.replay(); vi.advanceTimersByTime(REPLAY_MS.reading + REPLAY_MS.extracting); return s; };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the portfolio embed", () => {
  it("waits on the reading skeleton until it is told to replay", () => {
    const { embed, card } = setup();
    vi.advanceTimersByTime(10_000);
    expect(embed.state).toBe("idle");
    expect(card.classList.contains("skel")).toBe(true);
  });

  it("replays the real phases, then lands the filled card", () => {
    const { embed, card } = setup();
    embed.replay();
    expect(card.textContent).toContain("reading the page");
    vi.advanceTimersByTime(REPLAY_MS.reading);
    expect(card.textContent).toContain("the model is reading");
    vi.advanceTimersByTime(REPLAY_MS.extracting);
    expect(card.classList.contains("skel")).toBe(false);
    expect(card.querySelector("h2.title")!.textContent).toBe(FIXTURE_RECIPE.title);
    expect(embed.state).toBe("ready");
  });

  it("opens filled under reduced motion", () => {
    const { embed, card } = setup({ reducedMotion: true });
    expect(embed.state).toBe("ready");
    expect(card.querySelector("h2.title")).not.toBeNull();
  });

  it("fires the exact bytes and filename the extension writes", () => {
    const { embed, downloads } = landed();
    embed.fire();
    const fm = fixtureFrontmatter(FIRST_TICKET, NOW);
    expect(downloads).toEqual([{ markdown: serializeRecipe(FIXTURE_RECIPE, fm), filename: filenameFor(FIXTURE_RECIPE, fm) }]);
  });

  it("stamps FIRED, counts down, and resets with the next ticket", () => {
    const { embed, card, actions } = landed();
    embed.fire();
    expect(card.querySelector(".fired-stamp")).not.toBeNull();
    expect(actions.querySelector(".countdown")!.textContent).toBe(`Closing in ${CLOSE_AFTER_S}s`);
    vi.advanceTimersByTime(1000);
    expect(actions.querySelector(".countdown")!.textContent).toBe("Closing in 1s");
    vi.advanceTimersByTime(1000);
    expect(embed.state).toBe("ready");
    expect(embed.ticket).toBe(FIRST_TICKET + 1);
    expect(card.querySelector(".brand")!.textContent).toContain("00428");
    expect(card.querySelector(".fired-stamp")).toBeNull();
  });

  it("ignores Fire and Enter during the replay", () => {
    const { embed, downloads } = setup();
    embed.replay();
    embed.fire();
    enter();
    expect(downloads).toHaveLength(0);
  });

  it("fires once however often it is asked", () => {
    const { embed, downloads } = landed();
    embed.fire();
    embed.fire();
    enter();
    expect(downloads).toHaveLength(1);
  });

  it("fires on Enter once the card has landed", () => {
    const { downloads } = landed();
    enter();
    expect(downloads).toHaveLength(1);
  });

  it("fires on a click on FIRE", () => {
    const { actions, downloads } = landed();
    (actions.querySelector("#fire") as HTMLButtonElement).click();
    expect(downloads).toHaveLength(1);
  });

  it("copies the same markdown, says so, and keeps the icon", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const s = setup({ clipboard: { writeText } });
    s.embed.replay();
    vi.advanceTimersByTime(REPLAY_MS.reading + REPLAY_MS.extracting);
    const copy = s.actions.querySelector("#copy") as HTMLButtonElement;
    copy.click();
    await vi.waitFor(() => expect(copy.textContent).toContain("Copied"));
    expect(writeText).toHaveBeenCalledWith(serializeRecipe(FIXTURE_RECIPE, fixtureFrontmatter(FIRST_TICKET, NOW)));
    expect(copy.querySelector("svg")).not.toBeNull();
    vi.advanceTimersByTime(1600);
    expect(copy.textContent).toContain("Copy");
  });

  it("says Can't copy when the clipboard is refused", async () => {
    const s = setup({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    s.embed.replay();
    vi.advanceTimersByTime(REPLAY_MS.reading + REPLAY_MS.extracting);
    const copy = s.actions.querySelector("#copy") as HTMLButtonElement;
    copy.click();
    await vi.waitFor(() => expect(copy.textContent).toContain("Can't copy"));
    expect(copy.querySelector("svg")).not.toBeNull();
  });

  it("marks Prep and Archive as living in the extension, without disabling them", () => {
    const { embed, actions } = landed();
    for (const id of ["prep", "archive"]) {
      const b = actions.querySelector(`#${id}`) as HTMLButtonElement;
      // aria-disabled, not disabled: a disabled button gets no pointer events, so its title never shows.
      expect(b.getAttribute("aria-disabled")).toBe("true");
      expect(b.hasAttribute("disabled")).toBe(false);
      expect(b.title).toBe(IN_THE_EXTENSION);
      b.click();
    }
    expect(embed.state).toBe("ready");
  });
});
