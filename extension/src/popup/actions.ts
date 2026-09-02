import {
  ICON_ARCHIVE,
  ICON_BACK,
  ICON_COPY,
  ICON_FIRE,
  ICON_PREP,
  ICON_RETRY,
  ICON_SAVE,
} from "./glyphs";

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

// The label is bare FIRE rather than "FIRE · save .md" because the success row
// carries four buttons and the longer label wraps to two lines at that width
// (measured: the fire button is flex:1, so it gets 152px once Copy joins Prep
// and Archive). Bare FIRE also matches RETRY's idiom in the error row, and the
// format is no longer a variable — every fire writes .md, and the receipt names
// the file.
export const FIRE_BTN = (disabled: boolean): string =>
  `<button id="fire" class="fire-btn" type="button"${disabled ? " disabled" : ""}>` +
  `${ICON_FIRE}<span>FIRE</span><span class="kbd">↵</span></button>`;

export const ACTIONS = {
  // Idle, skeleton and Off Menu: nothing to fire or copy yet.
  extract: FIRE_BTN(true) + NAV,
  prep:
    `<button id="save" class="fire-btn" type="button">` +
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
  // NOTE: Copy has no .kbd chip yet, though ⌘C works — see the keydown
  // handler. Measured: the chip pushes this four-button row 43px past
  // the 400px content box, and it is still 12.6px over even with the
  // shortcut cut to a bare "C", secondary padding at 8px and the row
  // gap at 6px. Fitting it means tightening every row in the product
  // to serve one chip, so the tradeoff is Ben's call, not a silent one.
  `<button id="copy" class="secondary-btn" type="button">${ICON_COPY}<span>Copy</span></button>` +
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
    ? `<button id="retry" class="retry-btn" type="button">` +
      `${ICON_RETRY}<span>RETRY</span><span class="kbd">↵</span></button>`
    : "") + NAV;

export type View = keyof typeof ACTIONS;
