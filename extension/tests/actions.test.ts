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

  it("gives the fired row navigation instead of a dead end", () => {
    const doc = parse(FIRED_ACTIONS);
    expect(doc.querySelector(".countdown")!.textContent).toBe("Saved");
    expect(doc.querySelectorAll("button")).toHaveLength(2);
  });
});
