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
- BYOK: user's Anthropic key in `chrome.storage.local`; zero backend for AI
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

## Logo mark (locked — 2026-06-08, plate + mono-M)

The brand mark is a **top-down plate** — a single-pixel rounded rim — with the **Departure Mono "M" plated in the centre**. The M is the *actual* Departure Mono glyph, so the mark and the wordmark are one face: the type IS the identity. Drawn on the same coarse pixel grid (8px cells) as the Fire / In-the-Weeds / Off-Menu icons. **Monochrome** — the flame pixel was deliberately removed (Ben: "it makes it harder to read it as an 'M'"), so the single flame accent lives only in the UI (Fire button, FIRED stamp), never baked into the glyph. Source vector: Figma `Mise` node `107:1447`.

- **Geometry**: 13 cols × 14 rows pixel grid @ 8px/cell. The M letter occupies rows 3–10, cols 4–8; everything else is the plate rim.
- **Masters**: `type-specimens/mark/` — `mise-plate-on-dark.svg` (paper mark, for dark surfaces), `mise-plate-on-light.svg` (ink mark `#1e1e1e`, for light surfaces), `mise-plate-icon.svg` (ink tile `#232323` + paper mark, for app/extension/favicon — reads on any theme), `mise-plate-icon-16.svg` (M-only 16px variant).
- **PNG ladder**: `type-specimens/mark/png/mise-icon-{16,32,48,128}.png` (ready for the MV3 manifest at build time). Re-export by rasterizing the master SVGs at exact sizes (Playwright element screenshot, deviceScaleFactor 1) — 16 uses the M-only variant.
- **Favicon**: wired at `src/app/icon.svg` (Next.js App Router auto-serves it).
- **Crit trail**: `logo-plate.html` (3 plate directions — top-down / side-dish / knockout) → direction A (top-down) chosen → single-pixel rim → Ben finalised in Figma (`107:1447`) → `logo-mark.html` (the adopted mark, in-context: hero, ladder, lockup, toolbar states). Decision history in MemPalace (code/recipe_archiver, 2026-06-08).
- **Reduction note**: at ≤16px the 1px rim breaks up — ship the **M-only** variant (`mise-plate-icon-16.svg`, rim dropped). 128/48/32 carry the full plate.
- **Toolbar states**: idle = all-paper mark; recipe-detected = paper rim + **flame M** (only the M catches fire — a runtime UI state, not in the glyph).

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
5. Adversarial critique (`impeccable:critique` + `web-design-guidelines`) — **still owed a desk crit**
6. Final polish — **still owed a desk crit**
7. ~~Build track — Chrome MV3 extension~~ — done 2026-08-17, see `extension/` and the plan at `docs/superpowers/plans/2026-08-17-mise-extension.md`

Steps 5 and 6 were skipped, not completed: the build ran ahead of them because
crits need Ben in the room. The extension is a working target to crit against
now — which is a better artifact to critique than the specimens were.

## The extension (`extension/`)

Chrome MV3, TypeScript, esbuild, no framework. Zero backend — the popup calls
the Anthropic API directly with the user's key from `chrome.storage.local`.

```
npm run build:ext      # bundle to extension/dist (load unpacked from there)
npm run watch:ext      # rebuild on change
npm run test:ext       # vitest, 145 tests
npm run port:design    # re-port CSS + glyphs from type-specimens/
npm run smoke:ext      # load in real Chromium, assert all surfaces boot
npm run audit:ext      # diff popup.css classes against what the renderer emits
npm run test:live      # REAL billed calls to api.anthropic.com — opt-in, needs a key
```

**`test:live` is the only thing that proves the API contract.** Every test in
`tests/*.test.ts` mocks `client.messages.parse`, so they prove this code
handles a well-formed response and nothing about whether Anthropic produces
one. The live tests cover request shape, `parsed_output`, unit switching, the
`found: false` decline, and the vision blocks. They live in `tests/live/` under
a separate filename pattern (`*.live.ts`) and a separate config, so
`test:ext` can never run them by accident and bill you.

The key is read from `ANTHROPIC_API_KEY` in the environment, or a gitignored
`.env.local`. **Nothing in this repo ever writes the key** — creating that
file is the user's job:

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

**The design system is generated, not hand-written.** `src/popup/popup.css`
and `src/popup/glyphs.ts` come out of `type-specimens/popup-states.html` via
`extension/scripts/port-design.mjs`. Never hand-edit them: change the specimen,
run a desk crit, then `npm run port:design`. Extension-only chrome (the popup
window box, the Prep form, the Archive list) has no specimen equivalent and is
authored inside that script.

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
  persist in the error row too. That deviates from the specimen's error row
  (RETRY · Copy text · Prep); dropping Archive there would strand the user in a
  failed extraction with no route to their recipes. Copy keeps ⌘C and its line
  in the fallback list. **Owed a desk crit.**
- **`Esc` backs out of a pane before it closes the window.**
- The Archive list is authored for 400px — two-line rows, not the old
  7ch/1fr/12ch/22ch full-tab grid.

**Markup must match the specimen's tags**, because the ported CSS keys off
them: `h2.title`, `h3.section`, `.facts .fact > strong`, `ul.ingredients li >
.qty`, `ol.method` (numbering via `::before` — never hand-number), `.tags .tag`,
`.stamp` + `.glyph-mark` + `h2.stamp-title`.

**Model:** `claude-haiku-4-5` by default, switchable to `claude-opus-5` in Prep.
Haiku 4.5 supports structured outputs and vision but **not** `output_config.effort`
or adaptive thinking — sending either is a 400.

### Popup lifecycle — the popup is destroyed on every tab switch

An MV3 popup is a document Chrome tears down the moment it loses focus. Without
a cache, re-opening it re-runs the entire pipeline including a **billed** API
call. `src/lib/cache.ts` keys extractions by tab id in `chrome.storage.session`
(in-memory, never on disk — extraction results are derived data; the artifact is
the `.md`), guarded by both the tab's URL and a 1h TTL.

Consequence for ticket numbers: the card shows its number *before* the user
fires, so display calls `peekTicket()` and only `fire()` calls `nextTicket()`.
Allocating at extract time burned a number on every popup re-open.

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

### Not built yet

- **PDF export** — the `.pdf` action in the specimen needs the Next.js
  `/api/export/pdf` route; the button is not in the extension's action row.
- **Servings scaler, unit re-toggle, and the ambiguous/low-confidence picker
  states** — designed in `popup-states.html`, not wired. Their orphaned CSS is
  the `.picker` / `.arrow` / `.active` / `.meta` / `.ptitle` / `.psub` /
  `.recipe` / `.warn` / `.warn-glyph` block that `audit:ext` reports.
- **Capture filmstrip** (`.filmstrip` / `.frame` / `.thumb`) — frame thumbnails
  during video capture. Styled, never emitted; the capture phase currently
  shows only the chyron and progress meter.
- **Safari** — `safari-web-extension-converter` wraps a finished Chrome build.
- **Landing page.**

### Deferred to launch — multi-provider keys

**Decided 2026-08-17, explicitly not to be built yet.** At launch Prep should
accept a token from any AI provider — OpenAI, Grok, Anthropic, and whatever
else — not Anthropic alone. Until then Ben is the only user and BYOK-Anthropic
is sufficient.

Why it is worth noting now rather than discovering later: BYOK already means
the user brings their own credential, so provider choice is the same shape of
decision, not a new one. But it does touch three places that are currently
Anthropic-shaped — `createClient`, the structured-output call in
`extractRecipe` (`output_config.format`, `parsed_output`), and the vision
content blocks. Those are the seams to keep clean; a provider adapter is the
obvious form. Do not generalise them speculatively before the feature is
actually scheduled.

### Process — desk crits, not handoffs

Each pipeline step above ends in a **desk crit together**. Mise is a two-designer studio — Ben is the other designer, not a client signing off on deliverables. Every step ships only after we've stood in front of the work and talked through it.

How a crit runs: bring the artifact up where both of us can see it (local server + Playwright, Figma canvas, browser). Walk into one variant at a time — name the intentional decisions, what was considered and rejected, where tension remains. Stop. Listen. Ben pushes back, redirects, or approves. Fold the reaction in, advance.

Tone: peers, not reporter-to-approver. Strong opinions, loosely held, from both sides. Pushing back is the point of a crit — if Ben proposes something that pulls against the brief or the brand values we've set, say so and make the case.

Studio principles accumulating in `~/.claude/rules/design-studio-principles.md` — consult before crits. Add to that doc whenever a principle surfaces; don't re-derive the same ones each session.
