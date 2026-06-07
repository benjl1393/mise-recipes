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
- Same type + color system powers: the popup card, the `.md` frontmatter rendering, the PDF template, The Pass history view, and the Next.js fallback site
- One palette, one type scale, three surfaces

## The internal kitchen language

Names are load-bearing. Use them in code, UI, docs, and commit messages.

- **Mise** — product name (pronounced "meez")
- **Fire** — primary save button / action
- **The Pass** — full-tab history view
- **Prep** — options/settings page
- **In the Weeds** — error state when extraction fails

## Type + color + icons (locked — v2.1, 2026-04-24)

Three systems defined; see canonical docs:

- **Type**: Departure Mono (display) + Commit Mono (body + italic). See `type-specimens/index.html` + `type-specimens/snapshots/`.
- **Color**: Brutalist monochrome + flame. Neutral grays + a single accent family (flame at hue 30.4°, sanguine red — like digital-clock LED digits). See `docs/mise-color-system.md`.
- **Icons**: [Phosphor Icons](https://phosphoricons.com) — **thin weight** for functional chrome (keyboard-return, arrows, status glyphs, retry, close). Matches the hairline-rule aesthetic. Emojis are reserved for *content* (source-type badges like `🎬` for video, `📝` for article) where they function as cultural shorthand — never as functional chrome. Import hygiene: when pasting a Phosphor SVG into Figma, the enclosing 24×24 bounding frame sometimes comes in with a solid white fill as an import default — treat as chrome, leave as-is or scrub per case.

## Logo mark (locked — 2026-06-07, "The Spike")

The brand mark is a **kitchen order ticket** — the brief's existing ticket/receipt spine (`NO. 00427`, the popup-is-a-ticket) made into a glyph. The "spike" (orders speared on the kitchen rail) is implied entirely by **negative space**: a semicircle notch scooped from the ticket's top edge where it was pierced. No literal rod (rejected as too on-the-nose / read as a download arrow). One **flame fired-bar** = the fired item (the single accent), a shorter neutral knockout bar beneath it, and a torn/perforated bottom edge. Source vector: Figma `Mise` node `92:1381`.

- **Masters**: `type-specimens/mark/` — `mise-mark-on-dark.svg` (paper ticket, for dark surfaces), `mise-mark-on-light.svg` (ink ticket, for light surfaces), `mise-icon.svg` (ink tile, for app/extension/favicon — reads on any theme). Geometry on an 80×76 grid; notch r=6 dead-centre; flame bar `x12 y25 w57 h11`; knockout bar `x12 y42 w41.8 h8`. Flame is the locked `--flame` `#cb1200` (NOT the sketch's brighter `#fb2c1b`).
- **PNG ladder**: `type-specimens/mark/png/mise-icon-{16,32,48,128}.png` (ready for the MV3 manifest at build time). Re-export via `type-specimens/mark/_export.html`.
- **Favicon**: wired at `src/app/icon.svg` (Next.js App Router auto-serves it).
- **Crit trail**: `logo-marks.html` (4 directions, crit 01) → `logo-spike.html` / `logo-spike-neg.html` (refinement) → `logo-spike-final.html` (the locked mark, in-context). Decision history in MemPalace (code/recipe_archiver, 2026-06-07).
- **Reduction note**: at ≤16px the notch softens to a dimple; the red bar + tear keep it legible. The full mark is used at all sizes (no separate simplified glyph needed).

**Pivot history:**
- **v1** (through 2026-04-22): warm-cream split-complementary (cream + flame + copper + kitchen-dark). Rejected for hitting the AI-default "warm cream + rust + serif+sans" aesthetic.
- **v2** (2026-04-23): brutalist monochrome + flame at hue 35° (coppery orange). Deliberate anti-default commitment.
- **v2.1** (2026-04-24): flame hue shifted to 30.4° — sanguine red, digital-clock LED register. Less "campfire," more "service line." Resolves the long-standing AA-large-only flag for Fire button text (now AA-normal at 5.22:1). Triggered by the first Figma crit of 03A Success.

See the global `design-anti-ai-defaults.md` rule and `design-studio-principles.md` for the cross-project values these project decisions sit inside of.

## What to build next

1. ~~`impeccable:layout` + `impeccable:harden` — popup state variants~~ — done 2026-04-24, `type-specimens/popup-states.html`
2. ~~Logo mark + extension icon set~~ — done 2026-06-07, "The Spike" (see "Logo mark" section above)
3. Motion (`/flow` → `impeccable:animate`)
4. Microcopy pass (`ux-copywriter`)
5. Adversarial critique (`impeccable:critique` + `web-design-guidelines`)
6. Final polish
7. Build track — Chrome MV3 scaffold + Next.js landing (`superpowers:writing-plans`)

### Process — desk crits, not handoffs

Each pipeline step above ends in a **desk crit together**. Mise is a two-designer studio — Ben is the other designer, not a client signing off on deliverables. Every step ships only after we've stood in front of the work and talked through it.

How a crit runs: bring the artifact up where both of us can see it (local server + Playwright, Figma canvas, browser). Walk into one variant at a time — name the intentional decisions, what was considered and rejected, where tension remains. Stop. Listen. Ben pushes back, redirects, or approves. Fold the reaction in, advance.

Tone: peers, not reporter-to-approver. Strong opinions, loosely held, from both sides. Pushing back is the point of a crit — if Ben proposes something that pulls against the brief or the brand values we've set, say so and make the case.

Studio principles accumulating in `~/.claude/rules/design-studio-principles.md` — consult before crits. Add to that doc whenever a principle surfaces; don't re-derive the same ones each session.
