// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { ACTIONS, errorActions, FIRED_ACTIONS, NAV, SUCCESS_ACTIONS } from "../src/popup/actions";

const parse = (html: string): Document =>
  new DOMParser().parseFromString(`<body><div class="popup-actions">${html}</div></body>`, "text/html");

/** Every row this window can show, so a change is checked against all of them. */
const ROWS: Array<[string, string]> = [
  ["extract", ACTIONS.extract],
  ["prep", ACTIONS.prep],
  ["archive", ACTIONS.archive],
  ["success", SUCCESS_ACTIONS],
  ["fired", FIRED_ACTIONS],
  ["error retryable", errorActions(true)],
  ["error terminal", errorActions(false)],
];

describe("action rows", () => {
  it.each(ROWS)("every button in the %s row carries an icon", (_name, row) => {
    // A row with icons on some buttons and not others reads as unfinished.
    // This is the check that catches a new button added without one.
    for (const btn of [...parse(row).querySelectorAll("button")]) {
      expect(btn.querySelector("svg.btn-icon"), `${btn.id || btn.textContent} has no icon`).not.toBeNull();
    }
  });

  it.each(ROWS)("every button in the %s row keeps a text label", (_name, row) => {
    // The icons are decoration on top of the label, never a replacement:
    // aria-hidden on the svg means an icon-only button would be nameless.
    for (const btn of [...parse(row).querySelectorAll("button")]) {
      expect(btn.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it("hides the icons from assistive tech, since the label already names the button", () => {
    for (const svg of [...parse(SUCCESS_ACTIONS).querySelectorAll("svg.btn-icon")]) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("keeps Prep and Archive reachable from every extract-view row", () => {
    // Dropping Archive from the error row would strand the user in a failed
    // extraction with no route to their recipes (2026-08-18 desk crit).
    for (const row of [ACTIONS.extract, SUCCESS_ACTIONS, FIRED_ACTIONS, errorActions(true), errorActions(false)]) {
      const doc = parse(row);
      expect(doc.querySelector("#prep")).not.toBeNull();
      expect(doc.querySelector("#archive")).not.toBeNull();
    }
  });

  it("only offers RETRY when the failure is retryable", () => {
    expect(parse(errorActions(true)).querySelector("#retry")).not.toBeNull();
    // NO API KEY and KEY REJECTED are terminal, so the row is Prep · Archive.
    expect(parse(errorActions(false)).querySelector("#retry")).toBeNull();
    expect(errorActions(false)).toBe(NAV);
  });

  it("disables Fire on the idle row and enables it once a recipe has landed", () => {
    expect(parse(ACTIONS.extract).querySelector<HTMLButtonElement>("#fire")!.disabled).toBe(true);
    expect(parse(SUCCESS_ACTIONS).querySelector<HTMLButtonElement>("#fire")!.disabled).toBe(false);
  });

  it("offers Copy only once there is an artifact to copy", () => {
    expect(parse(SUCCESS_ACTIONS).querySelector("#copy")).not.toBeNull();
    expect(parse(ACTIONS.extract).querySelector("#copy")).toBeNull();
  });

  it("styles every keystroke chip by class alone, never inline", () => {
    // The RETRY chip had no box in the product while the specimen faked one
    // with an inline style, so the design document looked right and the
    // shipped button did not. One class, one rule, no local overrides.
    for (const [, row] of ROWS) {
      for (const chip of [...parse(row).querySelectorAll(".kbd")]) {
        expect(chip.getAttribute("style"), `${chip.textContent} chip is styled inline`).toBeNull();
        expect(chip.closest("button"), "a chip must live inside its button").not.toBeNull();
      }
    }
  });

  it("advertises Enter on every row whose primary action Enter triggers", () => {
    // Fire, Retry and Save are all bound to Enter in the keydown handler.
    for (const row of [ACTIONS.extract, ACTIONS.prep, SUCCESS_ACTIONS, errorActions(true)]) {
      const doc = parse(row);
      const primary = doc.querySelector("#fire, #retry, #save")!;
      expect(primary.querySelector(".kbd")!.textContent).toBe("↵");
    }
  });

  it("names the shortcut on every keystroke-bound button, for screen readers", () => {
    // The chip is visual only; aria-keyshortcuts is what assistive tech reads.
    for (const row of [ACTIONS.extract, ACTIONS.prep, SUCCESS_ACTIONS, errorActions(true)]) {
      const primary = parse(row).querySelector("#fire, #retry, #save")!;
      expect(primary.getAttribute("aria-keyshortcuts"), `#${primary.id}`).toBe("Enter");
    }
    // The keydown handler accepts either modifier, so both are named.
    expect(parse(SUCCESS_ACTIONS).querySelector("#copy")!.getAttribute("aria-keyshortcuts")).toBe("Meta+C Control+C");
  });

  it("says in plain words what Fire and Copy produce", () => {
    // Bare FIRE stays (desk crit 2026-10-01): the longer label wrapped to three
    // lines in the 118px the row leaves it. The tooltip carries the format.
    const doc = parse(SUCCESS_ACTIONS);
    expect(doc.querySelector("#fire")!.getAttribute("title")).toBe("Save as .md (Enter)");
    expect(doc.querySelector("#copy")!.getAttribute("title")).toBe("Copy the .md (⌘C)");
  });

  it("boxes only the gesture Mise teaches, not every shortcut", () => {
    // Desk crit 2026-10-01: a chip marks the one keystroke the product teaches
    // (Enter fires). ⌘C is the OS's own copy, and a chip for it overflowed the
    // row by 29.9px. Adding one is a design change, not a fix — revisit here.
    expect(parse(SUCCESS_ACTIONS).querySelector("#copy .kbd")).toBeNull();
  });

  it("gives the fired row navigation instead of a dead end", () => {
    const doc = parse(FIRED_ACTIONS);
    expect(doc.querySelector(".countdown")!.textContent).toBe("Saved");
    expect(doc.querySelectorAll("button")).toHaveLength(2);
  });
});
