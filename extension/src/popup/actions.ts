import {
  ICON_ARCHIVE,
  ICON_BACK,
  ICON_COPY,
  ICON_FIRE,
  ICON_PREP,
  ICON_RETRY,
  ICON_SAVE,
} from "./glyphs";
import type { Fallback } from "./render";

/**
 * The action row, one per view.
 *
 * Prep and Archive are panes rather than tabs, so the row has to change with
 * the view — there is no window chrome to carry navigation.
 *
 * Split out of popup.ts on 2026-08-30. popup.ts resolves its DOM handles at
 * module scope, so importing it outside a browser throws, and the rows could
 * not be rendered on their own to be looked at. They are markup, they have no
 * dependencies beyond the icons, and every row is now visible in one place —
 * which is what caught the error row rebuilding Prep and Archive inline
 * instead of reusing NAV.
 */
export const NAV =
  `<button id="prep" class="secondary-btn" type="button">${ICON_PREP}<span>Prep</span></button>` +
  `<button id="archive" class="secondary-btn" type="button">${ICON_ARCHIVE}<span>Archive</span></button>`;

// The label is bare FIRE rather than "FIRE · save .md", settled at the
// 2026-10-01 desk crit: the fire button is flex:1 and at its minimum, 118px,
// once Copy, Prep and Archive take their share, and the longer labels wrap to
// three and four lines in it (measured) — uppercased to ".MD" on top. The
// format is taught elsewhere: the title below, and the FIRED stamp, which names
// the .md file on the first press. Bare FIRE also matches RETRY's idiom.
//
// The chip marks the one keystroke Mise teaches; aria-keyshortcuts says it to
// a screen reader, which cannot see a chip.
export const FIRE_BTN = (disabled: boolean): string =>
  `<button id="fire" class="fire-btn" type="button" title="Save as .md (Enter)" aria-keyshortcuts="Enter"${disabled ? " disabled" : ""}>` +
  `${ICON_FIRE}<span>FIRE</span><span class="kbd">↵</span></button>`;

export const ACTIONS = {
  // Idle, skeleton and Off Menu: nothing to fire or copy yet.
  extract: FIRE_BTN(true) + NAV,
  prep:
    `<button id="save" class="fire-btn" type="button" aria-keyshortcuts="Enter">` +
    `${ICON_SAVE}<span>SAVE</span><span class="kbd">↵</span></button>` +
    `<button id="back" class="secondary-btn" type="button">${ICON_BACK}<span>Back</span></button>`,
  // The Archive is the closest thing this window has to a home, so Prep hangs
  // off it — that is the route to settings once a recipe has been fired.
  archive:
    `<button id="back" class="secondary-btn" type="button">${ICON_BACK}<span>Back</span></button>` +
    `<button id="prep" class="secondary-btn" type="button">${ICON_PREP}<span>Prep</span></button>`,
} as const;

/** A landed recipe: fire it, or copy the same .md to the clipboard. */
export const SUCCESS_ACTIONS =
  FIRE_BTN(false) +
  // Copy carries no .kbd chip, by decision (desk crit 2026-10-01): a chip marks
  // the gesture the product teaches, and ⌘C is the OS's own copy, which every
  // user already knows. A chip also overflowed this row by 29.9px (23.1px as a
  // bare "C"). The shortcut is still named — in the title, and to assistive
  // tech — and the keydown handler binds both modifiers.
  `<button id="copy" class="secondary-btn" type="button" title="Copy the .md (⌘C)" aria-keyshortcuts="Meta+C Control+C">${ICON_COPY}<span>Copy</span></button>` +
  NAV;

/**
 * After firing there is nothing left to do to this recipe, so the row becomes
 * pure navigation. This is what stops the fired state dead-ending: it used to
 * resolve to "Saved · Esc to close" with no route anywhere.
 */
export const FIRED_ACTIONS = `<span class="countdown">Saved</span>` + NAV;

/**
 * One row for every failure scenario, settled at the 2026-08-18 desk crit.
 * Prep and Archive are the only navigation this window has, so both persist
 * here — dropping Archive would strand the user in a failed extraction with
 * no route to their recipes. The specimen's third slot was Copy text; it was
 * cut rather than reinstated, because raw page text is not the clean .md the
 * product promises, and on the failures that most look like "nothing came
 * back" (NO API KEY, PAGE UNREADABLE) there is no text to copy at all.
 *
 * An unretryable failure renders no RETRY, so NO API KEY and KEY REJECTED
 * show `Prep · Archive` alone.
 */
export const errorActions = (canRetry: boolean): string =>
  (canRetry
    ? `<button id="retry" class="retry-btn" type="button" aria-keyshortcuts="Enter">` +
      `${ICON_RETRY}<span>RETRY</span><span class="kbd">↵</span></button>`
    : "") + NAV;

/**
 * The escape hatches listed inside the error card, matching the error row:
 * Retry only when the failure is retryable, Prep always. Each wears the icon
 * of the button it names, so the list and the row read as one set.
 */
export const errorFallbacks = (canRetry: boolean): Fallback[] => [
  ...(canRetry ? [{ icon: ICON_RETRY, text: "Retry with the same model", key: "↵" }] : []),
  { icon: ICON_PREP, text: "Open Prep to change key or model", key: "P" },
];

export type View = keyof typeof ACTIONS;
