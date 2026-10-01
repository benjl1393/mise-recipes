@AGENTS.md

# Mise — Design Context

## Purpose

Mise is a browser extension that extracts recipes from formats hostile to cooking — Instagram Reels, TikTok, YouTube videos of any length, recipe blogs, and paywalled regional food sites — and converts them into portable, open-format artifacts (`.md` / `.txt`) the user owns in perpetuity. The output is designed to travel freely between Apple Notes, Google Keep, Obsidian, Notion, or paper, without migration tooling.

The product's core promise is that it is deliberately **not a recipe app**. Mise is a one-way extraction tool: the user fires a recipe, receives an artifact, and leaves. No account, no subscription, no proprietary schema, no vendor lock-in. It adopts the solution shape of apps like Recime while rejecting their commercial capture model.

**Peak-moment surface:** the popup recipe card. The user clicks the toolbar icon on a Reel, TikTok, YouTube video, or blog page; a skeleton card appears immediately and fills in as extraction completes; pressing Enter or Fire writes the `.md` to disk and closes the popup. The save action and the reveal are a single moment — the card materializing *is* the delivery of the artifact.

## Audience

Home cooks who have accumulated a graveyard of saved recipe links across Instagram saves, TikTok bookmarks, YouTube watch-later, and browser tabs — and who find the collection unusable when it's time to actually cook.

Three failure modes the target user has felt repeatedly:

- **Video-format friction.** Recipes embedded in short-form video play far faster than anyone can follow at the stove. The format punishes the cook.
- **Link rot.** Personal blogs disappear; news sites purge archives; recipe URLs 404 months after they were saved.
- **Regional walls.** Sites like Gourmet Traveller paywall behind geoblocks or subscriptions, breaking access when the user has moved country or dropped the sub.

The solution is to convert all of these into owned, portable artifacts that survive platform changes and travel between apps.

The target user has saturated their app collection and is deliberately resistant to installing another destination. Mise must therefore function as a tool the user passes through, not a place they return to.

Explicitly **not** the audience: food bloggers, Notion power-users, recipe-app optimizers, or anyone seeking social, rating, or review features.

## Aesthetic Direction

**Personality: INDUSTRIAL.** Raw, edgy, professional-kitchen energy in the register of *The Bear* — service-line, not food-magazine.

**Object metaphor (sanity-check every decision against this):**
Mise should feel like a professional kitchen utensil — a Japanese gyuto or a five-ply AllClad skillet. A tool, not a document. Tactile, weighted, unmistakably serious. Premium through function rather than ornament. Every visible detail earns its place, in the way a gyuto's bolster or AllClad's exposed cladding layers do — functional geometry becoming aesthetic by consequence, never by intent.

### References

- **The Bear** — kitchen-ticket layout, on-screen chyrons, monospace menu typography
- **Criterion Collection / Pentagram** — stripped-back editorial graphic design, serious typography, restraint as flex

### Anti-references

- **NYT Cooking app** and **anything commercial**

This means NONE of:
- Stock food photography
- "Trending recipes this week" carousels
- Email-capture modals
- Sponsored-content shoulders
- Star ratings, reviews, social proof
- "Save to your cookbook" upsells
- Affiliate-link decoration
- "You might also like" cross-promotion

### Visual rules derived from the gyuto metaphor

- **No soft elements.** No rounded-everything, no drop-shadows-for-depth, no glassmorphism, no gradient meshes.
- **Real lines.** Hairline 1px/2px rules, not rounded CSS borders. Typography-as-texture does more work than boxes.
- **Knife-sharp typography pairing.** One decisive display cut + one refined workhorse (body and/or mono). Chosen, not defaulted.
- **Ticket-printer feel.** The popup itself IS the artifact. The `.md` is a typographic object in its own right.
- **Restraint is the edge.** Maximalism and minimalism both work — undecided middle ground does not.

### Anti-AI guardrails (hard rejects)

**Never use** any of: Inter, Roboto, Arial, Space Grotesk, DM Sans, Outfit, Plus Jakarta Sans, Instrument Sans/Serif, Fraunces, Newsreader, Lora, Crimson, Playfair Display, Cormorant, IBM Plex, Space Mono, Geist.

**Never use** purple-on-white gradients, cyan-on-dark gradients, glassmorphism-by-default, bounce easing everywhere, generic 12-col grid with icon+heading+text card rows.

## Constraints

**Technical:**
- Chrome MV3 popup, ~400px × variable height; Safari via `safari-web-extension-converter` wrapper
- Popup opens instantly — skeleton-first, no blocking web fonts on open
- BYOK: the user's own key — Anthropic, OpenAI, Gemini, Grok, Mistral, OpenRouter or any OpenAI-compatible server — in `chrome.storage.local`; zero backend for AI
- PDF export runs server-side (Next.js `/api/export/pdf` fallback) — reuses the same visual language as the popup
- Video extraction works on IG Reels, TikTok, YouTube Shorts, and **long-form YouTube of any length** — requires perceptual-hash dedupe + scene-change detection + hard frame cap (~24) to bound Haiku vision cost

**Accessibility:**
- WCAG AA contrast on all text
- Full keyboard nav: `Enter` = Fire (primary), `Esc` = close, `Tab` cycles logical order
- Screen-reader-friendly recipe markup (semantic headings, list for ingredients, ordered list for method)
- `prefers-reduced-motion` respected on the skeleton→filled transition

**Design-system reuse:**
- Same type + color system powers: the popup card, the `.md` frontmatter rendering, the PDF template, the Archive view, and the Next.js fallback site
- One palette, one type scale, three surfaces

## The internal kitchen language

Names are load-bearing. Use them in code, UI, docs, and commit messages.

- **Mise** — product name (pronounced "meez")
- **Fire** — primary save button / action
- **Archive** — the list of everything fired from this device. A pane in the popup, not a tab. Renamed from **The Pass** (2026-08-17) for the same reason In the Weeds became Kitchen Error: the kitchen term did not say what the view held. Archive also names the product promise — artifacts owned in perpetuity — rather than the mechanism.
- **Prep** — settings. Also a pane in the popup; the `options_page` was removed 2026-08-17
- **Off Menu** — empty state: the page has no recipe to extract

The error-state stamp reads **"Kitchen Error"** — the kitchen register is kept, but the word "Error" makes the failure unmistakable. Renamed from **"In the Weeds"** (dropped 2026-06-08 — too opaque; the weed pun didn't read as "something went wrong"). The refinement keeps a little voice while prioritising clarity. (The ticket-top status line may still read "EXTRACTION FAILED" as a plain descriptor; the *stamp* is "Kitchen Error".)

## Type + color + icons (locked — v2.1, 2026-04-24)

Three systems defined; see canonical docs:

- **Type**: Departure Mono (display) + Commit Mono (body + italic). See `type-specimens/index.html` + `type-specimens/snapshots/`.
- **Color**: Brutalist monochrome + flame. Neutral grays + a single accent family (flame at hue 30.4°, sanguine red — like digital-clock LED digits). See `docs/mise-color-system.md`.
- **Icons** (2026-06-09): two tiers. **Stamp glyphs = custom pixel art only** (broken plate, off-menu sheet, flame) — pixellation reads at large stamp size, NOT at small sizes. **All other functional chrome = [Tabler outline](https://tabler.io/icons) vector icons** (warning/alert, retry, copy, clipboard, photo, highlight, arrows, status, etc.) — clean technical strokes, referencing stove/oven control-panel iconography. (Switched from Phosphor → Tabler 2026-06-09.) Emojis are reserved for *content* (source-type badges like `🎬` video, `📝` article) — never functional chrome.

  **The action row wears them since 2026-08-30**, seven in total, pinned to
  Tabler v3.46.0: `flame` (Fire), `settings` (Prep), `history` (Archive),
  `refresh` (Retry), `copy` (Copy), `arrow-left` (Back), `device-floppy`
  (Save). Fire, Prep and Archive were Ben's call; the other four followed
  because a row with icons on some buttons and not others reads as
  unfinished — `tests/actions.test.ts` asserts every button in every row has
  one, and that none of them is icon-only (the svgs are `aria-hidden`, so a
  label-less button would be nameless to a screen reader).

  **Geometry is verbatim from the package, never hand-drawn** — only the inert
  `<path stroke="none" fill="none">` bounding box is dropped. The icons live
  in the specimen like everything else and are lifted into `glyphs.ts` by
  `port:design`, keyed on `data-icon`; the two that have no specimen variant
  (Back and Save belong to the Prep and Archive panes) are declared in a
  hidden `#icon-inventory` block so the set still has exactly one source.
  `@tabler/icons` is *not* a dependency — it was installed once to copy from.

  **Fire wears `flame` again since the 2026-10-01 desk crit** (it wore `cake`
  from 2026-08-31). Decided on real pixels, not a vector zoom: at 1x the
  cake's candle merged into its frosting and read as a box; the flame reads at
  both densities and names the verb. Rejected: `chef-hat` (the app, not the
  action), `bell-ringing` (the pass bell reads as notifications). The old
  objection — the FIRED stamp already wears the pixel flame — became the
  argument for it: the outline flame on the button becomes the pixel flame on
  the stamp, cause then effect in one symbol at two levels of finish.

  **A keystroke chip marks the gesture the product teaches, not every
  shortcut** (same crit). Enter fires, so Fire, RETRY and SAVE carry `↵`.
  Copy's ⌘C is the OS's own copy and carries no chip; it is named in the
  button's `title` and in `aria-keyshortcuts` instead (every keystroke-bound
  button has one, since a screen reader cannot see a chip). Adding a chip is a
  design change, and `tests/actions.test.ts` says so.

  **Stroke weight is 1.5, not Tabler's default 2** (2026-08-31, Ben's call),
  applied to all 26 icon instances in the specimen.

## Logo mark (locked — 2026-06-08, plate + mono-M)

The brand mark is a **top-down plate** — a single-pixel rounded rim — with the **Departure Mono "M" plated in the centre**. The M is the *actual* Departure Mono glyph, so the mark and the wordmark are one face: the type IS the identity. Drawn on the same coarse pixel grid (8px cells) as the Fire / In-the-Weeds / Off-Menu icons. **Monochrome** — the flame pixel was deliberately removed (Ben: "it makes it harder to read it as an 'M'"), so the single flame accent lives only in the UI (Fire button, FIRED stamp), never baked into the glyph. Source vector: Figma `Mise` node `107:1447`.

- **Geometry**: 13 cols × 14 rows pixel grid @ 8px/cell. The M letter occupies rows 3–10, cols 4–8; everything else is the plate rim.
- **Masters**: `type-specimens/mark/` — `mise-plate-on-dark.svg` (paper mark, for dark surfaces), `mise-plate-on-light.svg` (ink mark `#1e1e1e`, for light surfaces), `mise-plate-icon.svg` (**filled ink disc `#232323` + paper mono-M `#fafafa` knocked out, transparent frame** — app/extension/favicon), `mise-plate-icon-16.svg` (M-only 16px variant, **no longer read by the build**; kept as a master).

  **Polarity flipped 2026-08-20** on Ben's direct call: the icon was a dark tile
  with a paper mark, chosen because it read on any theme. It is now black-on-white.
  The tradeoff that buys back: a paper tile is a bright chip on a dark browser
  toolbar rather than disappearing into it — **owed a desk crit**. Note this is
  the *icon* only; `mise-plate-on-dark.svg` and `-on-light.svg` are unchanged and
  still carry the surface-appropriate variants.

  **The PNG ladder is generated, not exported.** `npm run gen:icons` rasterises
  both SVGs into `type-specimens/mark/png/` and emits
  `extension/src/lib/mark-geometry.ts`. The toolbar icon animates (see "Recipe
  pulse"), so the mark must be drawable at runtime in colours no exported asset
  contains — one geometry source keeps the pulse and the shipped PNGs in step.
  Change the SVG, then run `gen:icons`; never hand-edit the PNGs or the geometry.
- **PNG ladder**: `type-specimens/mark/png/mise-icon-{16,32,48,128}.png` (ready for the MV3 manifest at build time). Re-export by rasterizing the master SVGs at exact sizes (Playwright element screenshot, deviceScaleFactor 1) — 16 uses the M-only variant.
- **Favicon**: wired at `src/app/icon.svg` (Next.js App Router auto-serves it).
- **Crit trail**: `logo-plate.html` (3 plate directions — top-down / side-dish / knockout) → direction A (top-down) chosen → single-pixel rim → Ben finalised in Figma (`107:1447`) → `logo-mark.html` (the adopted mark, in-context: hero, ladder, lockup, toolbar states). Decision history in MemPalace (code/recipe_archiver, 2026-06-08).
- **Reduction note** (superseded 2026-08-20): the M-only variant existed because a 1px *rim* breaks up when downscaled. The plate is **filled** now, and a solid disc survives downscaling, so **one geometry carries the whole ladder**. On a retina display Chrome renders the 32px asset into the 16px slot, which is where the mark actually reads — the softer true-16px rendering only applies to non-retina.
- **Toolbar states**: idle = ink disc + paper M; recipe-detected = **flame disc + paper M** — *the whole plate catches fire*, the M stays paper throughout.

  **Reversed 2026-08-20, same day it was built.** The first version heated only the M, on the "smooth container, mechanical contents" reading. Ben overruled it, correctly: heating a few thin strokes is a weak signal at 16px, and a whole disc changing from ink to flame is a strong one. The parts live in the SVG — `data-part="plate"` and `data-part="letter"` — and `gen-icons.mjs` carries them through to `MARK_PLATE.plate` / `.letter`.

  **Transparent frame**, so the mark sits on any browser chrome instead of carrying its own tile. **Known and accepted:** on a *dark* toolbar the idle ink disc has very little contrast against the chrome. Decided 2026-08-20 to leave it — the paper M stays fully legible, so the mark still reads even when the disc doesn't separate, and the disc is a container rather than the thing you read. Rejected: a paper hairline around the disc (costs the brutalist solidity), and shipping per-theme icon sets (Chrome gives extensions no reliable way to detect toolbar theme, so it would need a hand-set preference).

**Pivot history:**
- **v1** (through 2026-04-22): warm-cream split-complementary. Rejected for hitting the AI-default "warm cream + rust + serif+sans" aesthetic.
- **v2 / v2.1** (2026-04-23/24): brutalist monochrome + flame; flame hue settled at 30.4° sanguine red.
- **v2.2** (2026-06-10): brand-vs-error collision resolved. Brand stays sanguine red; error stays red; differentiation is *structural* — **red is contextually exclusive** (action OR failure per screen; the error action row goes neutral/bone). Rejected en route: char near-black error, and a gas-flame blue primary (prototyped in `type-specimens/color-blue-flame.html` — red won as the stronger CTA). See `docs/mise-color-system.md` Principle 6.
- **"The Spike"** (2026-06-07, retired): a kitchen order-ticket glyph — negative-space notch + flame fired-bar + torn edge (Figma `92:1381`, 80×76 grid). Committed at `7a2a72e`, then reopened. Old masters archived at `type-specimens/mark/_archive-spike/`.
- **plate + mono-M** (2026-06-08, current): the Mono-M direction (rejected earlier as "a lone M is too generic") revived and fixed by plating it. Monochrome. The spike-themed motion signature (ticket speared onto a rail) was dropped in the same pivot — the FIRED stamp landing is now the motion signature instead.

See the global `design-anti-ai-defaults.md` rule and `design-studio-principles.md` for the cross-project values these project decisions sit inside of.

## What to build next

1. ~~`impeccable:layout` + `impeccable:harden` — popup state variants~~ — done 2026-04-24, `type-specimens/popup-states.html`
2. ~~Logo mark + extension icon set~~ — done; "The Spike" (2026-06-07) → repivoted to **plate + mono-M** (2026-06-08, see "Logo mark" section above)
3. Motion (`/flow` → `impeccable:animate`)
4. Microcopy pass (`ux-copywriter`)
5. ~~Adversarial critique (`impeccable:critique` + `web-design-guidelines`)~~ — run
   2026-08-20, report at `docs/crit-2026-08-20-step5.md`. 33/40 on Nielsen; zero
   AI-slop antipatterns.
6. ~~Final polish~~ — applied 2026-08-20 from the step 5 findings: the API-key link
   (P0), the specimen/product drift (P1), and `color-scheme` (P3).

   **Two findings are deliberately still open, because they are design-authority
   calls rather than polish** — the flame focus ring colliding with Principle 6
   on error screens, and unvirtualized 500-row Archive rendering. Both are argued
   in the crit doc. **Owed a desk crit.** The third, the 10.5px secondary
   navigation, was settled at the 2026-10-01 crit: 11.5px at 0.06em tracking,
   size bought with letter-spacing so every row keeps its width.

   The error-row crit (2026-08-18) is done and folded in — see "One window,
   three panes".
7. ~~Build track — Chrome MV3 extension~~ — done 2026-08-17, see `extension/` and the plan at `docs/superpowers/plans/2026-08-17-mise-extension.md`
8. ~~Post-fire navigation, Copy-to-clipboard, and the `author` field~~ — done 2026-08-18, see "Navigation" below

Steps 5 and 6 were originally skipped, not completed: the build ran ahead of them
because crits need Ben in the room. They were run on 2026-08-20 against the built
extension rather than the specimens, which is the better artifact — and the crit
immediately found that the specimen had drifted from what actually ships. Findings
that are genuinely Ben's call were left open rather than decided in his absence.

9. ~~Off Menu rework, action-row icons, FIRED stamp, cache fix, Obsidian `.md`
   fixes~~ — done 2026-08-30 → 2026-09-01 on branch `worktree-mise-permission-fix`
   (PR #2). See the sections above for each; the short list is the Off Menu
   inversion, seven Tabler icons on the action row, the FIRED stamp inverted with
   Ben's pixel flame, `cake` on Fire, boxed keystroke chips, a 15.8px action-row
   overflow fixed, the post-fire cache bug fixed, two Obsidian YAML defects, the
   ingredient gutter changed from a middle dot to a pipe, and the Vercel deploy
   unbroken.

   **The Vercel fix is worth knowing about, because it will recur.** The root
   `tsconfig.json` includes `**/*.ts` and excluded only `node_modules`, so
   `next build` type-checked `extension/src` — code written against
   `extension/tsconfig.json` at `target: ES2022`, where the BigInt literals in
   `frames.ts` are legal. The root targets `ES2017`, so the deploy failed on
   `0n`. **Two configs, one of them reaching into code that is not its own.**
   It had been failing on `main` too, not just on the branch. The root now
   excludes `extension` and `.scratch`; the extension keeps full coverage via
   its own config and `test:ext`. If a new top-level directory ever carries
   TypeScript with its own tsconfig, add it to that exclude list.

### Where this stands (2026-09-01) — read this first in a new session

**Everything below is committed and pushed. Working tree clean, `tsc` clean,
212 tests green, `audit:ext` unchanged across every commit.**

**Decided and shipped, do not re-litigate:**

- Ingredient gutter is `  |  ` (pipe). The tag line keeps `  ·  `. Both
  rationales, and the four rejected candidates, are in `docs/mise-md-format.md`
  and the `SEPARATOR` doc comment.
- `ticket` is quoted and `captured` carries seconds **and a UTC offset**. Without
  the offset the value parses as UTC and shows the wrong time — see the YAML
  typing table in the format spec.
- Firing no longer clears the extraction cache.

**Open — needs Ben, not a decision to make in his absence:**

1. **Five Obsidian `.md` improvements, researched but NOT built.** Ingredient
   `- [ ]` checkboxes; frontmatter reordered so cook-facing fields lead and
   provenance trails; substitutions as prose (`guanciale (or pancetta)`, a prompt
   change only); `## Notes` as a `> [!tip]` callout; and `cssclasses: [mise]`
   plus an optional CSS snippet. That last one is the real answer to the gutter
   collapsing — it is the only route that restores the intended column rendering
   inside Obsidian without compromising the plain-text file. Deferred as
   expensive: ingredient/method grouping via `###`, which changes the `Recipe`
   type, the prompt, the serializer *and* the 400px card.
2. **Owed a desk crit**, accumulated and each argued where it sits: the Off Menu
   stamp size; no in-product route to re-extract a fired page inside the 1h TTL;
   plus the two still open from the 2026-08-20 crit. **Settled 2026-10-01**, as
   the four items visible in the portfolio's embedded popup: Fire's icon
   (`flame`), its label (bare `FIRE` plus a title), the secondary type (11.5px /
   0.06em) and the Copy chip (none, by rule) — see the Icons section.

**The render harness is `npm run render:states` now** — promoted out of
`.scratch/` and committed on 2026-09-02, because it is what found the 15.8px row
overflow and it should not die with a worktree. See "Looking at the popup
states" below.

## The extension (`extension/`)

Chrome MV3, TypeScript, esbuild, no framework. Zero backend — the popup calls
the chosen provider's API directly with the user's key from `chrome.storage.local`.

```
npm run build:ext      # bundle to extension/dist (load unpacked from there)
npm run watch:ext      # rebuild on change
npm run test:ext       # vitest, 354 tests
npm run port:design    # re-port CSS + glyphs from type-specimens/
npm run smoke:ext      # load in real Chromium, assert all surfaces boot
npm run audit:ext      # diff popup.css classes against what the renderer emits
npm run render:states  # render every popup state to static HTML, to look at
npm run build:embed    # the popup as a static folder for the portfolio (--out <dir>/mise)
npm run render:portfolio # every Mise image on the portfolio (--out <dir>)
npm run test:live      # REAL billed calls to every vendor you have a key for — opt-in
```

**`test:live` is the only thing that proves the API contract.** Every test in
`tests/*.test.ts` mocks the wire (the Anthropic SDK client, or `fetch`), so they
prove this code handles a well-formed response and nothing about whether a
vendor produces one. The live tests cover request shape, `parsed_output`, unit switching, the
`found: false` decline, and the vision blocks. They live in `tests/live/` under
a separate filename pattern (`*.live.ts`) and a separate config, so
`test:ext` can never run them by accident and bill you.

The keys are read from one variable per vendor — `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`,
`OPENROUTER_API_KEY` — in the environment, or a gitignored `.env.local`. A
vendor without a key is skipped, not failed (`tests/live/providers.live.ts`).
**Nothing in this repo ever writes a key** — creating that file is the user's
job:

```
ANTHROPIC_API_KEY=sk-ant-... npm run test:live
```

**`audit:ext` exists because unit tests cannot see an unstyled card.** It
reports classes styled in `popup.css` but never emitted (a designed state that
was not built, or a name that drifted) and the inverse. Two real bugs were
found this way: the skeleton shimmer never ran because the animation is scoped
to `.skel .bar` and nothing added `skel`, and the whole error callout +
fallback list was missing. Remaining `MISSING` entries are the unbuilt picker
/ filmstrip states plus dead specimen scaffolding (`.popup-frame`,
`.chrome-caption`) — treat a *new* entry as a regression.

### The portfolio embed — the real popup, on benjaminli.xyz

**Added 2026-10-01** for the long-form `/work/mise` page. `src/embed/` drives
the real renderer, action rows and serializer with a fixture (specimen 03A, the
Gochujang card): it replays the real skeleton phases, Fire downloads exactly
the `.md` the extension writes, and where the extension would close the card
resets with the next ticket. Prep and Archive are `aria-disabled` with an
"In the extension" title — not `disabled`, which would swallow the title.

- **`npm run build:embed -- --out <portfolio>/public/embeds/mise`** writes it
  as a static folder plus `provenance.json` (commit, dirty, builtAt). The
  portfolio copy is generated, never hand-edited: change the popup here,
  rebuild, recopy.
- **It is published on a public site, so it can never carry a key**: the
  build never reads `api_key.txt` and defines `__MISE_DEV_KEY__` as `""`, and
  a test asserts the bundle has no `sk-ant-`.
- **It deletes its output folder first**, so it refuses any `--out` whose last
  segment is not `mise` or `.embed`. The test proves the guard with a sentinel
  file, not merely that the script throws.
- **`dirty` ignores untracked files** (`--untracked-files=no`): they are not
  build inputs, and this checkout carries some that are not ours.
- **`npm run render:portfolio -- --out <dir>`** regenerates every Mise image on
  the portfolio — cover, card stills, the April/now before pair, the stamp
  ladder, the pipeline diagram — serving its own pages, so it needs no `dist/`.

The page talks to the embed with two same-origin messages: `mise:visible`
starts the first replay once the iframe is loaded and half on screen, and
`mise:replay` restarts it.

### Looking at the popup states

`npm run render:states` renders every state — both stamps, the fired receipt over
a real card, and all the action rows — to `extension/.render/states.html` using
the **real** renderer, the **real** action rows and the **real** generated
stylesheet. Serve it over HTTP and look at it; `file://` blocks the web fonts, so
Departure and Commit Mono silently fall back to system mono and misrepresent the
typography.

This exists because `popup.ts` resolves DOM handles at module scope, so it cannot
be imported outside a browser — `actions.ts` was split out precisely so the rows
could be rendered on their own and reviewed. It has earned its keep: the success
row was overflowing the 400px window by 15.8px for a day, and no unit test, audit
or type-check could see it.

**It bundles itself in memory on every run, and that is deliberate.** The
`.scratch/` version needed a manual `esbuild` step first, and re-running the
stale bundle renders *fresh CSS with old markup* — a page that looks entirely
coherent and is wrong only in the half you just changed. That produced one
confidently wrong measurement before it was caught. Nothing is written to disk to
go stale now, so the failure mode is structurally impossible rather than merely
documented.

**Checking whether a row fits:** do not trust `scrollWidth`. `.popup-actions` is
`overflow: visible`, so it reads equal to `clientWidth` while buttons spill off
the edge. Measure the last button's right edge against the row's content box, in
a real browser — the snippet is in the script's header comment.

**The design system is generated, not hand-written.** `src/popup/popup.css`
and `src/popup/glyphs.ts` come out of `type-specimens/popup-states.html` via
`extension/scripts/port-design.mjs`. Never hand-edit them: change the specimen,
run a desk crit, then `npm run port:design`. Extension-only chrome (the popup
window box, the Prep form, the Archive list) has no specimen equivalent and is
authored inside that script.

### Recipe pulse — the toolbar icon as a detector

**Added 2026-08-20.** When a page declares itself a recipe, the toolbar icon
pulses red three times and then holds at flame for as long as that tab is on the
recipe. The title changes to `Recipe found — fire it to Mise`, so the signal is
not carried by colour alone.

- **Detection is deliberately narrow** (`src/lib/detect-recipe.ts`): schema.org
  `Recipe` in JSON-LD, or the same type in microdata. Both are things a publisher
  set on purpose. The caption/video heuristics `pickSource` uses for Reels and
  TikTok are *excluded* — they are the right call once the user has decided to
  fire, and far too loose to decide on their behalf. A false pulse costs more
  than a missed one: an icon that cries recipe everywhere is one you stop seeing.
- **The detector is DECLARED in the manifest**, matching `https://*/*` and
  `http://*/*`, so host access is granted at install.

  **This reverses the original design, and the reversal was earned.** The pulse
  was built as a progressive enhancement: `optional_host_permissions`, a
  `chrome.permissions.request()` from a Prep toggle, and
  `chrome.scripting.registerContentScripts` at runtime, so a plain install asked
  for nothing. It works in Chrome. It does **not** work in Dia, which never shows
  the permission prompt and never fires `permissions.onAdded` — so the feature was
  simply dead there, with no error anywhere to explain it. Confirmed by running
  the same build in both browsers. Ben chose install-time access over losing the
  feature in his daily browser; revisit before shipping if the install prompt
  matters more than fork support.

  **The Prep toggle survived, with different plumbing.** It flips a stored
  `pulseOnDetect` setting instead of a permission, so the user still decides
  whether the icon pulses. The content script reads it at `document_idle` and
  bails before doing any work. Default on — detection only fires on a declared
  `schema.org/Recipe`, so it is quiet everywhere else and needs no opting into.
- **The pulse is finite, and that is load-bearing.** An MV3 worker is only
  reliably alive for a short window after the event that woke it, so an endless
  animation would die at whatever frame Chrome chose. Settling into a steady
  state means the useful information survives suspension. It is also better
  manners — a permanent pulse is a nag, not a signal.
- **It ramps in discrete steps, not a smooth fade** — the motion spec's "smooth
  container, mechanical contents", and flame is derived from digital-clock red.
  It should read as a seven-segment display coming up to heat.
- **The whole plate heats; the M stays paper.** Reversed the same day it was
  built — see the toolbar-states note above. Heating only the M was the tidier
  reading of the motion spec, and the weaker signal.
- **Everything above was checked at true 16px, rendered, not reasoned about.**
  Worth keeping that habit: the rejected "flood the square tile" variant washed
  to pink mid-ramp with the M dissolved into it, which is invisible in a
  description and obvious in a contact sheet. The version that shipped — flood
  the *disc*, keep the M paper — is the same idea shaped to the mark rather than
  to the frame, and it holds all the way down the ramp.

### Navigation — the Archive is the nearest thing to a home

**Decided 2026-08-18.** Mise still has no home screen, and shouldn't: the product
is a tool you pass through. But firing used to dead-end — the receipt's
countdown resolved to `Saved · Esc to close` with no route anywhere. Prep and
Archive now persist through the whole lifecycle, and **Prep hangs off the
Archive** (`Back · Prep`), which is what a home screen would otherwise have
existed to provide.

Rows by state:

| State | Row |
|---|---|
| Idle / skeleton / Off Menu | `FIRE`(disabled) · Prep · Archive |
| Extracted | `FIRE` · Copy · Prep · Archive |
| Fired, closing | `Closing in Ns` · Prep · Archive |
| Fired, stayed | `Saved` · Prep · Archive |
| Error | `RETRY` · Prep · Archive |
| Archive | Back · Prep |
| Prep | `SAVE` · Back |

Every one of those rows lives in `src/popup/actions.ts`, split out of
`popup.ts` on 2026-08-30. `popup.ts` resolves its DOM handles at module scope,
so importing it outside a browser throws and the rows could not be rendered on
their own to be looked at — which is the whole process here. Seeing them in
one file immediately turned up the error row rebuilding Prep and Archive from
its own string literals instead of reusing `NAV`; it now calls
`errorActions(canRetry)`. If you add a row, add it to `ROWS` in
`tests/actions.test.ts` and to `audit-port.mjs`'s source list.

- **Reaching for Prep or Archive cancels the auto-close.** Navigating *is* the
  decision to stay, so the old `Keep open` button is gone. Without this the
  window would shut while the user was mid-Prep.
- **`Copy` copies the finished `.md`** — the same bytes Fire writes — for Notes,
  Obsidian, anywhere. Not to be confused with the raw-page-text Copy cut from
  the error row on the same day: that offered unstructured scrapings, this
  offers the artifact. It uses the *peeked* ticket, so copying never burns a
  number.
- **The primary button is bare `FIRE`, not `FIRE · save .md`** — settled at the
  2026-10-01 desk crit. Fire is flex:1 and at its 118px minimum in the
  four-button row; `FIRE · .md` wraps to three lines and `FIRE · save .md` to
  four (measured), and the uppercase transform renders `.md` as `.MD`. The
  format is taught where it fits: the button's title ("Save as .md (Enter)"),
  and the FIRED stamp, which names the file on the first press.

### Deferred — PDF export and the format dropdown

**Parked 2026-08-18.** Prep was to get a file-type dropdown (`.md` / `.pdf`).
Dropped for now: there is no PDF engine in the extension and no
`/api/export/pdf` route, so shipping it means either a client-side generator
with Departure/Commit Mono embedded, or a backend round-trip that breaks the
zero-backend BYOK model. Every fire writes `.md` until that is scheduled.

**Download location is also parked**, and note *why*, so it isn't re-litigated:
Chrome gives extensions no way to set the download directory. Per the
`chrome.downloads` docs, "absolute paths, empty paths, and paths containing
back-references '..' will cause an error" — `filename` is always relative to the
user's Downloads folder. The only routes to an arbitrary folder are a
subdirectory under Downloads, or `saveAs: true`, which opens the OS file chooser
on every fire and breaks the fire-and-leave gesture.

### One window, three panes

Prep and Archive were separate pages that opened tabs. Ben's note (2026-08-17):
leaving the popup to change a setting or check a past recipe breaks the
fire-and-leave gesture the product is built around. They are panes now —
`src/popup/views/prep.ts` and `views/archive.ts`, mounted into `#prep-view` /
`#archive-view`, routed by `showView()`. There is one stylesheet, one document,
and no `options_page`.

Consequences worth knowing:

- **Returning from a pane must never re-run `run()`.** The extract view's
  action row is remembered in `extractActions` and restored on the way back,
  so a filled card, an error row or the fired receipt all survive the detour.
  Re-running would cost another billed call.
- **Prep and Archive are the only navigation this window has**, so both buttons
  persist in the error row too — `RETRY · Prep · Archive`, in every failure
  scenario. Dropping Archive there would strand the user in a failed extraction
  with no route to their recipes. **Settled at the 2026-08-18 desk crit**, which
  also **cut Copy text entirely** — the button, the `⌘C` binding, and its
  fallback line. Two reasons: raw page text is not the clean `.md` the product
  promises, so offering it dressed as a fallback oversells it; and on the
  failures that most look like "nothing came back" (`NO API KEY`,
  `PAGE UNREADABLE`) the throw happens before any text is harvested, so there
  is nothing to copy. The specimen was updated to match, so the two agree again.
  Note the one asymmetry: an unretryable failure renders no RETRY, so
  `NO API KEY` and `KEY REJECTED` show `Prep · Archive`.
- **`Esc` backs out of a pane before it closes the window.**
- The Archive list is authored for 400px — two-line rows, not the old
  7ch/1fr/12ch/22ch full-tab grid.

**Markup must match the specimen's tags**, because the ported CSS keys off
them: `h2.title`, `h3.section`, `.facts .fact > strong`, `ul.ingredients li >
.qty`, `ol.method` (numbering via `::before` — never hand-number), `.tags .tag`,
`.stamp` + `.glyph-mark` + `h2.stamp-title`, and on the Off Menu screen
`p.off-note` + `p.off-hint`.

### Off Menu — the stamp stopped being the message (2026-08-30)

Ben's note: the screen was low-contrast italic text under a heavy boxed stamp,
and "OFF MENU" on its own is cryptic. Three changes, all from that one crit.

- **The stamp is inverted, and quieter.** It was a 2px box around near-black
  text, which made it the loudest object on an otherwise empty screen. It is
  now a filled `--ink-dim` block with the glyph and title knocked out in
  paper — what a rubber stamp actually looks like — and no border at all.
  Measured in-browser at **5.93:1**, so it clears AA for normal text, never
  mind the 3:1 its 28px title needs. `.stamp.err` gets the same treatment on
  `--flame-deep`, which *strengthens* colour v2.2's Principle 6: failure now
  owns the red as a fill, so the action row stays bone.
- **The message leads.** `.off-note` is 15px, full ink, no italic (18.26:1)
  and says "Nothing to cook here." `.off-hint` underneath stays quiet at
  `--ink-dim` (5.93:1) and carries the recovery. `text-wrap: balance` rather
  than a `max-width` — at 40ch the line broke after "Open" with a third of
  the card empty beside it.
- **The card no longer butts into the button panel.** `.off-hint` carries a
  20px bottom margin, which is the gap Ben asked for.

The stamp is deliberately still large. Ben asked for *reduced contrast*, not a
smaller stamp, and the hierarchy now reads stamp → headline → hint. **Owed a
desk crit** if it still feels heavy on the real 400px window.

### FIRED — the same inversion, and a flame instead of a tick (2026-08-31)

Ben asked for the Off Menu treatment to carry over to the fired stamp, and for
the pixel flame he drew to replace the `✓`. Both landed; the three stamps are
now one family.

- **The mark is inverted** like `.stamp` — was a 2px box around near-black text
  on paper, now a filled block with the glyph and wordmark knocked out. Measured
  in-browser: FIRED and the glyph **18.26:1**, the `saved to …` line **10.1:1**
  at 11px. Both clear AA comfortably.
- **The fill is `--ink-primary`, deliberately not flame.** The colour system is
  explicit that *"success has no dedicated color … the glyph carries the
  meaning"*, and Principle 6 keeps red contextually exclusive — failure owns it.
  So the set reads as a **value ladder**: `--ink-dim` grey nothing-here,
  `--ink-primary` near-black delivered, `--flame-deep` red broken.
- **The glyph is the pixel flame**, master at
  `type-specimens/mark/mise-fired-flame.svg`. A tick is app-generic; Fire is the
  verb this product is built on. Geometry verbatim — only the hard-coded
  `#010101` is dropped so it inherits `currentColor` and knocks out of the fill.
- **It renders at 34px with `shape-rendering: crispEdges`, and both halves of
  that matter.** Its viewBox is 28×34, so 34px puts exactly one grid unit on one
  CSS pixel, which is what makes it safe to switch anti-aliasing off. It is the
  only stamp glyph with **1-unit features** — at the 30px the other two use they
  landed on 0.88px and blurred into a smudge beside Departure Mono's chunky
  letterforms.

  **`crispEdges` is NOT applied to the other two glyphs**, and that was checked
  side by side rather than assumed: without AA the broken plate's circular rim
  goes visibly uneven, because its curves render at a fractional scale where the
  anti-aliasing is doing real work. The rule is *crisp when the glyph lands on
  an integer multiple of its own grid*, not "pixel art wants crisp edges."

**The stamp glyphs are keyed by `data-glyph` now**, the way the Tabler icons are
keyed by `data-icon`. `port:design` used to destructure them positionally out of
an array asserted to be length 2, which a third glyph breaks — and would have
broken silently by reordering rather than loudly. Adding a fourth is now an
entry in `WANTED_GLYPHS`.

### The action row fits again, and the chips are one rule (2026-08-31)

Ben: *"keystroke icons need to be in a rectangular box. it's missing on the
retry button. also please slightly round the corners"* / *"reduce strokeweight
of tabler icons."*

- **The chip rule left `.fire-btn`.** It is `.popup-actions .kbd` now, with
  `border: 1px solid currentColor` and `border-radius: 2px`, so one rule reads
  on the flame fill and the bone fill alike. It was scoped to `.fire-btn`,
  which is why the shipped RETRY chip had no box at all — **the specimen had
  been faking one with an inline style**, so the design document looked right
  while the product did not. `tests/actions.test.ts` now asserts no `.kbd`
  carries a `style` attribute, and that every Enter-bound primary advertises `↵`.
- **Tabler strokes went 2 → 1.5**, all 26 icon instances in the specimen.

**The success row had been overflowing the popup by 15.8px, and nothing
caught it.** Once every button grew an icon (2026-08-30), `FIRE + Copy + Prep +
Archive` needed ~412px in a 400px window; `FIRE` is `flex: 1` so it collapsed to
min-content and `Archive` quietly spilled off the edge. Fixed by taking
`.secondary-btn` horizontal padding from 11px to 8px — every row now fits.

**Why no existing check caught it, which is the part worth keeping:** the row is
`overflow: visible`, so **`scrollWidth` does not report the overflow** — it reads
equal to `clientWidth` and looks clean. `audit:ext` compares class names, not
geometry, and the unit tests run in happy-dom, which has no layout at all. The
only test that finds it is measuring **the last button's right edge against the
row's content box** in a real browser:

```js
last.right - (row.getBoundingClientRect().right - parseFloat(cs.paddingRight))
```

Run that against every row after any change to a button's label, icon, padding
or chip.

### Decided — Copy carries no chip (2026-10-01)

**⌘C is wired** (`popup.ts` keydown, either modifier, guarded on an empty
selection so a real text selection still copies normally). Copy has **no
`.kbd` chip, by rule rather than by squeeze**: a chip marks the gesture the
product teaches, and ⌘C is the OS's own. Measured at the crit with the new
11.5px type: `⌘C` overflows the success row by 29.9px, a bare `C` by 23.1px.
The shortcut is named in Copy's `title` ("Copy the .md (⌘C)") and in
`aria-keyshortcuts="Meta+C Control+C"`. Rejected: no chips anywhere (deletes
the cue for the central gesture) and widening the popup past 400px.

**Model:** Prep picks a provider and a tier, **Fast** or **Thorough**; each
provider maps the two to its own models (see Providers). Anthropic's are
`claude-haiku-4-5` and `claude-opus-5-5`. Haiku 4.5 supports structured outputs
and vision but **not** `output_config.effort` or adaptive thinking — sending
either is a 400.

### Popup lifecycle — the popup is destroyed on every tab switch

An MV3 popup is a document Chrome tears down the moment it loses focus. Without
a cache, re-opening it re-runs the entire pipeline including a **billed** API
call. `src/lib/cache.ts` keys extractions by tab id in `chrome.storage.session`
(in-memory, never on disk — extraction results are derived data; the artifact is
the `.md`), guarded by both the tab's URL and a 1h TTL.

Consequence for ticket numbers: the card shows its number *before* the user
fires, so display calls `peekTicket()` and only `fire()` calls `nextTicket()`.
Allocating at extract time burned a number on every popup re-open.

**Firing must not drop the cache entry (fixed 2026-08-31).** `onFire()` used to
call `clearCache(tabId)`, with a reason that was true as far as it went: the
cached card holds the *peeked* ticket, so re-offering it would show a number
that had since been consumed. But the cure was worse than the disease — every
re-open of the popup on a page the user had just saved re-ran the entire
pipeline (content script, frame capture, and another **billed** Anthropic call)
for a recipe already on disk. That is precisely when a user is most likely to
re-open: to check it saved, or to get to the Archive.

The fix rewrites the entry instead of deleting it, with the **committed**
frontmatter — which settles the stale-ticket problem properly — plus a
`firedAs` field holding the filename. `run()` sees `firedAs` on a cache hit and
restores the receipt (dimmed card, FIRED stamp, `Saved · Prep · Archive`)
rather than offering Fire a second time. **No countdown on restore**: re-opening
is a deliberate act, so closing the window out from under the user would be
hostile.

Two things worth knowing about the shape of this fix:

- **`run()` clears `.fired` at the top.** The class lives on `#card`, which is
  the `.popup` element, and it survives an `innerHTML` swap — so without this a
  later extraction renders greyed out under nothing.
- **There is no in-product route to re-extract a fired page** while the entry is
  live (same tab, same URL, inside the 1h TTL). That is a small capability loss
  versus the old behaviour, which re-extracted automatically *because* it was
  the bug. `clearCache()` is kept as the primitive for a deliberate "extract
  this page again" gesture, but nothing calls it yet — **owed a desk crit**. The
  workaround meanwhile is that the cache is keyed on the exact URL, so adding a
  `#` fragment forces a fresh extraction.

**Note for testing:** this is why re-firing the same page repeatedly no longer
costs a call — which is also why a test loop needs the fragment trick above.

### Video capture and social pages

**Never call `chrome.permissions.request()` from the extraction flow.** It
requires a live user gesture, and by the time the video branch is reached the
popup has awaited settings, the tab query, the cache and the content script —
the gesture is long gone, so it throws and takes the whole extraction with it.
It is also unnecessary: `activeTab` already grants `tabs.captureVisibleTab` on
the tab the user invoked Mise from. (Proof it is granted: `executeScript`
works on the same tab, via the same permission.) `optional_host_permissions`
stays in the manifest per spec but nothing requests it.

Frame capture failures are caught and swallowed — a caption with no frames
still beats no recipe, because on a Reel the caption usually *is* the recipe.

**Social video hosts are matched by hostname, not by heuristic**
(`SOCIAL_VIDEO_HOSTS` in `page-source.ts`). Readability frequently *succeeds*
on Instagram/TikTok/YouTube — it latches onto a sidebar or comment column and
returns a confident block of navigation — so neither "did parsing work" nor
"is the text long" can detect an app shell; both are satisfied by chrome. On
those hosts the caption comes from `og:description` (then `twitter:description`,
then `description`), which is where these platforms actually publish the post
text. Caveat: on long-form YouTube `og:description` can be a truncated video
description, so the frames carry most of the signal there by design.

### Failure states

`src/popup/errors.ts` classifies a thrown error into a shouted label, an HTTP
code, one actionable sentence, and `canRetry`. The card then renders
`.callout.error` + `ul.fallback-list`, and the action row swaps Fire for
**RETRY** — there is no artifact to save, and the swap is what keeps colour
v2.2's rule that red is contextually exclusive (failure owns the red, so the
primary button goes bone). A raw SDK message like "400 Bad Request" tells a
home cook nothing, which is why the taxonomy exists.

**The error card wears icons, not glyphs (2026-10-01).** The callout's `▲`
became Tabler `alert-triangle`, and the fallback list's `↻` / `→` became the
icons of the buttons they name — `refresh` (Retry) and `settings` (Open Prep)
— so the list and the row below read as one set. The list lives in
`errorFallbacks(canRetry)` in `actions.ts`, beside `errorActions`, so it is
testable and the portfolio renders the real one. The specimen's 03C card was
brought back in line with the product at the same time (it still showed
"Switch to Haiku (H)"). **Not yet fixed:** the Off Menu specimen (01C) still
draws an unbuilt fallback list with `↵ ⇞ ⋆` text glyphs; choosing icons for
features that do not exist yet is Ben's call.

**Provider failures are classified in the adapters, not here (2026-10-01).**
Both adapters throw one `ProviderError` with a *kind* — auth, billing, rate,
overloaded, rejected, server, network, timeout, truncated, malformed — because
vendors disagree on status codes: a bad key is 401 at OpenAI, Mistral and
OpenRouter but **400 at Gemini and xAI**, and Anthropic reports a low credit
balance as a 400. `errors.ts` only words a kind. Labels stay short and
vendor-free; bodies name the vendor ("OpenAI refused that key"). `CLAUDE
OVERLOADED` became `OVERLOADED` in the product and in the specimen's 03C card.
A Custom endpoint's 404 blames the base URL, not the model, and copy only
offers "switch between Fast and Thorough" where that menu exists.

### Not built yet

- **PDF export** — see "Deferred — PDF export and the format dropdown" above
  for why it is parked and what building it would actually cost.
- **Servings scaler, unit re-toggle, and the ambiguous/low-confidence picker
  states** — designed in `popup-states.html`, not wired. Their orphaned CSS is
  the `.picker` / `.arrow` / `.active` / `.meta` / `.ptitle` / `.psub` /
  `.recipe` / `.warn` / `.warn-glyph` block that `audit:ext` reports.
- **Capture filmstrip** (`.filmstrip` / `.frame` / `.thumb`) — frame thumbnails
  during video capture. Styled, never emitted; the capture phase currently
  shows only the chyron and progress meter.
- **Safari** — `safari-web-extension-converter` wraps a finished Chrome build.
- **Landing page.**

### Providers — any vendor's key (2026-10-01)

Ben: *"we need to build it so that users add their own api key … regardless of
ai vendor"* — scheduled for the portfolio's "Try it" section. Spec and plan:
`docs/superpowers/specs/2026-10-01-multi-vendor-keys-design.md`,
`docs/superpowers/plans/2026-10-01-multi-vendor-keys.md`.

**Two paths, one core.** `lib/extract.ts` holds everything vendor-independent
(schema, prompt, output validation, frame sampling) and dispatches to
`lib/providers/anthropic.ts` (the SDK call, unchanged in what it sends) or
`lib/providers/openai-compat.ts` (plain `fetch` to `{baseURL}/chat/completions`,
the shape OpenAI, Gemini, xAI, Mistral, OpenRouter and most local servers
speak). `resolveConnection(settings)` turns Prep's settings into what an adapter
needs; every vendor quirk lives in `lib/providers/presets.ts` and nowhere else.

| Provider | Fast | Thorough | Quirks |
|---|---|---|---|
| Anthropic | `claude-haiku-4-5` | `claude-opus-5-5` | native Messages API |
| OpenAI | `gpt-6-luna` | `gpt-6.1-sol` | strict schema, `max_completion_tokens`, `reasoning_effort: low` |
| Gemini | `gemini-3.5-flash-lite` | `gemini-3.8-flash` | `reasoning_effort: low` (not `minimal`) |
| Grok | `grok-4.3` | `grok-4.7` | `max_completion_tokens` |
| Mistral | `mistral-small-latest` | `mistral-medium-latest` | **8 images max** — frames are sampled evenly |
| OpenRouter | `google/gemini-3.5-flash-lite` | `anthropic/claude-opus-5.5` | strict, `provider.require_parameters` |

Model IDs were read from each vendor's docs on 2026-10-01 and will drift; the
live test is what notices.

- **The Chat Completions path sends a nullable rewrite of the schema** (every
  field required, the five optional ones `T | null`), which OpenAI's strict mode
  demands; `validateOutput` turns the nulls back into absent fields and rejects
  anything the card cannot render. The Anthropic path keeps `RECIPE_SCHEMA`.
- **Key detection is a convenience, never a lock.** Ordered prefixes: `sk-ant-`,
  `sk-or-`, `xai-`, `AIza`/`AQ.`, then bare `sk-` as OpenAI. Mistral keys have no
  prefix. Detection never moves the menu off Custom, because DeepSeek and other
  compatible vendors also issue `sk-` keys.
- **Custom** takes a base URL (normalised: trailing `/chat/completions` stripped)
  and a model ID, and may be keyless (no `Authorization` header) for a local
  server. `http://localhost` is the expected case; LAN addresses are unverified.
- **Retries are asymmetric on purpose.** The SDK retries twice (it always did);
  the fetch path makes one attempt with a 120 s timeout, and RETRY is the retry.
- **The embed bundle must carry no key prefix.** `storage.ts` imports
  `presets.ts`, so `lib/providers` is in the embed's import graph via
  `fire.ts`; tree-shaking keeps the prefixes out, and `build-embed.test.ts`
  fails loudly if that ever changes.
- **Verified live: Anthropic only (2026-10-01).** A clean `npm run test:live`,
  10/10 on `claude-haiku-4-5` through the new code path: article, imperial
  units, schema.org block, the `found: false` decline, tags, both vision tests,
  and `providers.live.ts`'s text / decline / frames. (Two earlier runs that day
  hit 401s — first a dead key, then a fresh key still propagating.) OpenAI,
  Gemini, Grok, Mistral, OpenRouter and Custom are **unverified**: proven only
  against their documented request and error shapes until `test:live` passes
  with their keys. Record each here when it does.
- **Prep in Custom scrolls** by about 70px inside Chrome's 600px popup cap; the
  pane was already a scroll container.

### Process — desk crits, not handoffs

Each pipeline step above ends in a **desk crit together**. Mise is a two-designer studio — Ben is the other designer, not a client signing off on deliverables. Every step ships only after we've stood in front of the work and talked through it.

How a crit runs: bring the artifact up where both of us can see it (local server + Playwright, Figma canvas, browser). Walk into one variant at a time — name the intentional decisions, what was considered and rejected, where tension remains. Stop. Listen. Ben pushes back, redirects, or approves. Fold the reaction in, advance.

Tone: peers, not reporter-to-approver. Strong opinions, loosely held, from both sides. Pushing back is the point of a crit — if Ben proposes something that pulls against the brief or the brand values we've set, say so and make the case.

Studio principles accumulating in `~/.claude/rules/design-studio-principles.md` — consult before crits. Add to that doc whenever a principle surfaces; don't re-derive the same ones each session.
