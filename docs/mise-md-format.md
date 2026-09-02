# Mise — `.md` Format Specification

**Status:** v1 draft (2026-04-22)
**Source of truth:** this document. Popup, PDF, and the Archive view are typographic renderings of the format defined here. Nothing may appear in a rendered surface without a corresponding `.md` field.

---

## Overview

Mise writes one `.md` file per captured recipe. The file is the artifact — the product's output and its brand. Plain-text mono is the kitchen-ticket aesthetic; the file reads cleanly in Obsidian, Notion, Apple Notes, `cat`, and on paper.

A Mise `.md` file has three zones:

1. **YAML frontmatter** — structured capture metadata
2. **Body** — title, optional subtitle, ingredients, method, optional notes
3. **Trailing block** — tag line, horizontal rule, footer

---

## Frontmatter Schema

```yaml
---
ticket: "00427"
captured: 2026-04-22T16:28:31+02:00
source: https://instagram.com/p/C9xK2
via: 8 video frames
author: J. Kenji López-Alt   # optional — only when the source credits someone
serves: 4
hands_on: 25m
total: 2h 10m
units: metric            # optional — only if user overrode default
scaled: 1.0              # optional — only if user changed servings
---
```

### Field reference

| Field | Type | Required | Source |
|---|---|---|---|
| `ticket` | 5-digit zero-padded integer, **quoted** | yes | device-local counter in `chrome.storage.local`, incremented per capture. Displayed in popup/PDF as `NO. XXXXX` (typographic convention for numbered tickets). The quotes are load-bearing — see YAML typing below. |
| `captured` | ISO 8601 datetime, **with seconds and a UTC offset** | yes | extension generates at save time. Both parts are load-bearing — see YAML typing below. |
| `source` | URL | yes | tab URL at capture time |

### YAML typing — why two fields are punctuated the way they are

Obsidian parses frontmatter with **js-yaml**, and two fields are silently
mangled without the punctuation above. Verified against js-yaml 4.1.1:

| Emitted | Parsed as | Result in Obsidian |
|---|---|---|
| `ticket: 00427` | `427` *(number)* | ✗ zero-padding gone — the Properties panel shows `427` |
| `ticket: "00427"` | `"00427"` *(string)* | ✓ the ticket reads as printed |
| `captured: 2026-04-22T16:28` | `"2026-04-22T16:28"` *(string)* | ✗ Text, not a date — will not sort or filter |
| `captured: 2026-04-22T16:28:31` | `Date` | ✗ **read as UTC** — a 16:28 Zurich capture shows as 18:28 |
| `captured: 2026-04-22T16:28:31+02:00` | `Date` | ✓ the right instant, in the reader's zone |

The seconds and the offset are separate fixes for separate bugs. Seconds alone
make the value a date at the **wrong time**, which is worse than a string
because it looks correct. `formatCapturedYaml()` in `extension/src/lib/markdown.ts`
emits both; `formatCaptured()` is unchanged and still produces the
minute-precision, zone-free form the popup's ticket-top stamp wants.
| `via` | string (vocabulary below) | yes | inferred from successful extraction path |
| `author` | string | no | Mise-extracted — the recipe's credited writer, as the source names them, without titles or affiliations. Omitted when the source attributes nobody; never inferred from the site or channel name. Rendered on the card as a byline beneath the subtitle. |
| `serves` | string | yes | Mise-extracted, Claude-normalized (`"4"`, `"makes 12"`, `"serves 6-8"`). Rendered as `SERVES X`. |
| `hands_on` | string | no | hands-on cooking time — time at counter/stove, excluding passive waits (marinating, oven-braising, rising). Rendered as `HANDS-ON 25m`. Underscore key for JS-identifier compatibility. |
| `total` | string | no | total elapsed time including passive. Rendered as `TOTAL 2h 10m`. |
| `units` | `"imperial"` \| `"metric"` | no | only if user overrode default during Prep |
| `scaled` | float, default `1.0` | no | only if user changed servings during Prep |

### `via` — extraction-method vocabulary

Controlled strings. English-only at v1; i18n in v2.

- `"8 video frames"` / `"N video frames"` — IG Reel, TikTok, YouTube Short/Long (N ≤ 24)
- `"caption only"` — social post where only caption text was usable
- `"schema data"` — `schema.org/Recipe` JSON-LD on page
- `"article text"` — blog/article parsed via Readability
- `"manual paste"` — user pasted URL or text into popup fallback
- `"image upload"` — user uploaded a cookbook-page photo

Reserved for v2: `"translated from {lang}"` (suffix appended when recipe-translate feature ships).

---

## Body Structure

### Title

```markdown
# Gochujang-Glazed Pork Belly
```

- Normal case in the source file; popup/PDF uppercase via CSS.
- No inline markup (no bold, no links).
- One line, no trailing punctuation.

### Subtitle (optional)

```markdown
*slow-rendered, sharply-sauced, served over rice with a soft egg.*
```

- Single line of italic text (`*...*`) immediately after the title.
- NOT a blockquote — the subtitle is a tagline, not a quoted passage. Using `*italic*` is semantically correct.
- Present when Mise's extraction produces a usable one-line description; omitted otherwise.
- Rendered as dim + italic body text in popup/PDF. Requires a body font with a real italic variant (Basier Square Mono rejected for this reason; v1 uses JetBrains Mono).
- In Apple Notes and other non-markdown renderers, the asterisks will show literally. This is acceptable — the source is honest about its intent, and Obsidian / Notion / popup / PDF all render correctly.

### Ingredients

```markdown
## Ingredients
- 800 g  |  pork belly, skin-on
- 3 tbsp  |  gochujang paste
- 2 tbsp  |  honey or maltose
- 1½ tbsp  |  soy sauce (light)
- 4 cloves  |  garlic, crushed
- 1 thumb  |  ginger, julienned
- —  |  spring onion & sesame to finish
```

- Each line: `- <qty>  |  <item>`
- Separator: `  |  ` — two spaces, pipe (`U+007C`), two spaces. Five characters total, gives visual breathing room in mono-rendered plain text.
- **Why a pipe and not a middle dot** (changed 2026-09-01): Obsidian renders Markdown to HTML, and HTML collapses whitespace runs — so the five-character gutter reaches the reader as a *single space*, and a `·` all but disappears between the columns. The gutter survives intact only in source view, `cat`, and on paper. A pipe spans the full line height and so reads as a rule rather than a mark once collapsed. It is ASCII, so it is safe in the proportional fallback fonts Apple Notes uses, and it leaves `✶` as the only star in the file.
- Rejected en route: an em-dash (already the qty placeholder, so `- — — spring onion` would be unreadable), `::` (Dataview inline-field syntax — every ingredient would spawn a phantom field), an asterisk (rides toward cap-height, so it reads as a footnote marker on the qty rather than a divider, and it dilutes the `✶` signature), and `│` box-drawing (a finer rule in mono, no better once collapsed, less certain in fallback fonts).
- The pipe is Markdown-safe, verified through a CommonMark parser: a list item carrying pipes cannot become a table (GFM requires a delimiter row), and the pipe has no inline meaning outside a wikilink, which this format never emits.
- `<qty>` format: space between number and unit (`800 g`, `1½ tbsp`). Vulgar fractions (`½`, `⅓`, `¼`, `¾`) preferred over decimals when culturally natural.
- `<item>` format: lowercase prose, brief modifiers acceptable (`crushed`, `julienned`, `skin-on`).
- No measurable quantity: use em-dash `—` as the qty placeholder (`— · spring onion & sesame to finish`). Common for finishing garnishes.

### Method

```markdown
## Method
1. Score the pork belly skin in a crosshatch, just through the fat. Salt heavily, uncovered in the fridge overnight — this is non-negotiable.
2. Sear skin-down in a dry cast-iron until the skin blisters and shatters when tapped. Drain most of the fat.
3. Whisk gochujang, honey, soy, garlic and ginger with 100 ml water. Pour around (not over) the pork. Cover, oven 160 °C for 90 minutes.
4. Uncover, turn skin-up, ladle the sticky sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.
```

- Standard ordered list (`1.`, `2.`). Renderers pick their own numbering style.
- Popup/PDF render as `01`, `02` via `list-style-type: decimal-leading-zero`.
- Each step is prose. No sub-bullets — if a source has nested sub-steps, flatten them into a single paragraph using em-dashes or semicolons.
- Numbers/units inside a step stay in source style (`160 °C`, `100 ml`) and convert along with the rest during unit toggles.

### Notes (optional)

```markdown
## Notes
- Use Korean-brand gochujang for authentic heat profile.
- Pork can marinate up to 48 hours — flavor improves.
```

- Present only when the source provides genuine additional context — substitutions, source tips, provenance, variations.
- Bulleted list, single-column (no qty).
- Omitted entirely when source has nothing worth preserving. Do not pad.

---

## Trailing Block

```markdown
---
#cuisine/korean · #pork · #braise · #weeknight

✶ mise.app
```

Three elements, in order: horizontal rule, tag line, blank line, footer.

### Tag line

- One line of inline hashtags, joined by ` · ` — **single** spaces around the middle-dot, unlike the five-character ingredient separator. The ingredient separator is wide because it doubles as the qty/item column gutter; the tag line is an inline run with nothing to align, so it takes the narrow form. (Corrected 2026-08-17: this line previously claimed the ingredient separator, contradicting every rendered example in this document and in `type-specimens/`.)
- Tags are Mise-generated at extraction time; user can add/remove/custom-add via the Prep panel.
- Indexed natively by Obsidian (tag pane + Dataview), Apple Notes (tag system), and Notion (hashtag chips).
- Stored **only inline** — not duplicated in frontmatter. Obsidian indexes inline hashtags identically to frontmatter `tags:` fields.

### Tag format

- Namespaced: `#namespace/value` (e.g., `#cuisine/korean`)
- Flat: `#tag` (e.g., `#pork`)
- Sanitization: lowercase, kebab-case for multi-word values (`#slow-cooker`, not `#slow_cooker` or `#slowCooker`). No whitespace inside a tag.

### Taxonomy (v1, opinionated)

| Dimension | Shape | Examples |
|---|---|---|
| Cuisine | `#cuisine/*` | `#cuisine/korean`, `#cuisine/italian`, `#cuisine/french`, `#cuisine/japanese`, `#cuisine/mexican` |
| Main ingredient | flat | `#pork`, `#chicken`, `#beef`, `#fish`, `#lamb`, `#egg`, `#tofu`, `#mushroom`, `#legume`, `#grain`, `#vegetable` |
| Technique | flat | `#braise`, `#grill`, `#roast`, `#stir-fry`, `#raw`, `#bake`, `#no-cook`, `#pressure`, `#slow`, `#steam`, `#deep-fry` |
| Time bucket | flat | `#weeknight` (hands_on ≤ 45m), `#weekend`, `#make-ahead` |
| Dietary | flat, conservative | `#vegetarian`, `#vegan`, `#gluten-free`, `#dairy-free`, `#nut-free` — only when confidently true |

Mise targets 3–5 tags per recipe. User-added tags are free-form (Prep panel text entry) but Mise doesn't establish new *namespaces* for user tags — they land flat.

### Footer

```markdown
✶ mise.app
```

- Exactly one line: glyph `✶` (`U+2736`), one space, `mise.app`.
- No link markup. The string is a durable brand signature, not a clickable URL.

---

## Customization → `.md` Data Flow

Prep panel controls map to `.md` fields and content:

| Prep control | Effect on file |
|---|---|
| Toggle tag chip | Add/remove from tag line |
| Add custom tag | Append sanitized `#tag` to tag line |
| Unit toggle (Imperial ⇄ Metric) | Add `units: <choice>` to frontmatter; convert all qty and temperature values in body (Claude-assisted conversion) |
| Servings scaler | Add `scaled: <float>` to frontmatter; multiply all qty values in body |

The saved `.md` reflects whatever the user sees in the preview at Fire time. WYSIWYG.

### Unit conversion quality (Mise's killer feature)

The value proposition from user: *"i've found many recipes i would like to use but are in imperial units. which often means i have to convert everything whilst cooking so this brings the most value to the user."*

Conversion rules:

- Claude performs conversion at extraction time, not naive math. `⅓ cup` → `80 ml`, not `0.333 cup`. `1 cup flour` → `125 g flour` (weight preferred for baking).
- Volume → weight conversions depend on ingredient. Flour ≠ sugar ≠ water. Claude applies contextual density.
- Temperature follows the unit system: imperial → °F, metric → °C. No separate temperature control.
- Fractions round to culturally native increments (`½`, `⅓`, `¼`) in the output unit system.

---

## Full Example

```markdown
---
ticket: "00427"
captured: 2026-04-22T16:28:31+02:00
source: https://instagram.com/p/C9xK2
via: 8 video frames
serves: 4
hands_on: 25m
total: 2h 10m
---

# Gochujang-Glazed Pork Belly

*slow-rendered, sharply-sauced, served over rice with a soft egg.*

## Ingredients
- 800 g  |  pork belly, skin-on
- 3 tbsp  |  gochujang paste
- 2 tbsp  |  honey or maltose
- 1½ tbsp  |  soy sauce (light)
- 4 cloves  |  garlic, crushed
- 1 thumb  |  ginger, julienned
- —  |  spring onion & sesame to finish

## Method
1. Score the pork belly skin in a crosshatch, just through the fat. Salt heavily, uncovered in the fridge overnight — this is non-negotiable.
2. Sear skin-down in a dry cast-iron until the skin blisters and shatters when tapped. Drain most of the fat.
3. Whisk gochujang, honey, soy, garlic and ginger with 100 ml water. Pour around (not over) the pork. Cover, oven 160 °C for 90 minutes.
4. Uncover, turn skin-up, ladle the sticky sauce over every few minutes for the final 15 minutes at 200 °C until lacquered.

---
#cuisine/korean · #pork · #braise · #weeknight

✶ mise.app
```

---

## Rendering Rules

The `.md` is the source. Popup, PDF, and the Archive are typographic renderings. Content parity is mandatory.

### Core principle — no invented styling

Any typographic treatment in a rendered surface must correspond to a markup signal in the `.md` source:

| Source markup | Allowed rendering treatment |
|---|---|
| `# heading` | display-size type, CSS-uppercase, rule below |
| `## heading` | small-caps mono, letter-spaced, rule below |
| `*italic*` / `_italic_` | italic — used for the subtitle line |
| `> blockquote` | structural indent, hairline left rule, dim color (reserved for future use — not currently used by Mise) |
| `**bold**` | bold (currently unused by Mise — no bold source markers) |
| `` `code` `` | inline mono span (currently unused by Mise in body content) |
| `- list` | bulleted list with grid columns for qty + item |
| `1. ordered` | ordered list with `decimal-leading-zero` counter |
| `#hashtag` | dim tag chip coloring |

Renderers **must not** apply font-style, weight, or decoration beyond what the source markup specifies. Italic in rendering implies `*...*` in the source. Facts rows (serves / hands_on / total) that are structurally plain frontmatter values get plain mono treatment, not bold/italic embellishment.

This rule exists because the `.md` is the artifact and must be visually legible as written. Popup/PDF can amplify existing markup, never invent new treatments.

### Typographic role assignment

Popup and PDF use a two-font system with **role-based** (not case-based) assignment:

| Role | Font | Applied to |
|---|---|---|
| **Chrome** — the ticket's frame and structural bones | Departure Mono | Ticket-top brand + captured stamp · ticket-bottom footer · recipe title (`# ...`) · section headings (`## Ingredients`, `## Method`, `## Notes`) · any brand-stamp or structural label |
| **Content** — the actual recipe data | Commit Mono | Source URL row · extraction-method badge · subtitle (`*italic*`) · facts row (serves / hands_on / total) · ingredients list (qty + item) · method step prose · notes bullets · tag line · PDF source-provenance footer |

The mental model: **Departure Mono is the chit printer's banner — short uppercase stamps framing the order. Commit Mono is the order itself — everything the cook actually reads.**

The title is the one chrome element allowed to violate size-uniformity to hero the recipe name (display-size Departure Mono). Every other chrome element is xs (popup 10px, PDF 9px) and reads as a frame, not content.

Case follows font: chrome rows are `uppercase` via CSS (source stays normal-case); content rows preserve the source's case (lowercase URLs, mixed-case prose, etc.).

### Popup (Chrome MV3, 400px wide × variable)

- **Frontmatter → ticket-top**: `MISE · NO. <ticket>` (left) ↔ `<captured date · time>` (right), dashed rule below. Then `<source domain>` (left) ↔ `via:` badge e.g. `🎬 8 FRAMES` (right), dashed rule below. (Display convention: `NO.` is the typographic stamp for "number" on a chit; the YAML key is `ticket:` because it names the concept.)
- **Title**: Departure Mono, display size, CSS-uppercase.
- **Subtitle**: Basier Square Mono, dimmed.
- **Facts row (serves / hands_on / total)**: inline, mono labels + bold values, ruled top + bottom. Labels render as `SERVES`, `HANDS-ON`, `TOTAL`.
- **Ingredients**: CSS grid with `qty` column width-anchored. The ` · ` in the source becomes the column gutter; renderer can optionally hide the dot itself.
- **Method**: ordered list, `list-style-type: decimal-leading-zero` → `01.`, `02.`.
- **Tag line**: dim mono row above footer.
- **Footer**: `✶ mise.app` (dim) aligned right; `<captured>` aligned left, dashed top rule.
- **Fire + Prep + Shopping actions**: popup chrome rendered *below* the ticket-bottom — these are the extension's own UI, not `.md` content.

### PDF (A4-ish, 595 × 842 pt)

- Same structure. Breathes larger. Single-column ingredients for most recipes; two-column for long ingredient lists (>15 items).
- Print-safe rule weights: 0.5pt (dashed), 1pt (solid).
- Cream card on white page.
- Footer gains a small Mise wordmark + source URL + captured timestamp for provenance.

### Archive (a pane in the popup; renamed from The Pass 2026-08-17)

- List view: one row per ticket. Row shows `NO. <number>` · title · captured · source domain. Mono throughout.
- Click row → expand in-place to the same popup card layout.
- Search/filter by tag, source, ticket number, date range.
- Layout details defined at `impeccable:layout` step.

---

## Platform Compatibility

| Platform | Behavior |
|---|---|
| **Obsidian** | Properties panel parses frontmatter. Tag pane indexes inline `#hashtag`. Dataview queries `file.tags` (covers inline). |
| **Apple Notes** | Frontmatter renders as literal YAML text. Inline `#hashtag` recognized as native Apple Notes tag. |
| **Notion** | Frontmatter imported as content block. Inline `#hashtag` becomes hashtag chip. |
| **Google Keep** | Plain text. No tag parsing. |
| **`cat` / Vim / less** | Plain mono text. Fully readable. |
| **Paper printout** | Mono. Ingredients' qty column aligns via the ` · ` separator. |

Designed to degrade gracefully: maximum fidelity in Obsidian, readable everywhere else.

---

## Mandatory Ordering

The `.md` file uses a fixed element order. Any renderer or parser can rely on it:

1. Frontmatter fence open (`---`)
2. Frontmatter fields (ticket, captured, source, via first; then serves, hands_on, total; then units, scaled if present)
3. Frontmatter fence close (`---`)
4. Blank line
5. Title (`# <name>`)
6. Blank line
7. Subtitle (`*<text>*`) — optional
8. Blank line (if subtitle present)
9. `## Ingredients`
10. Ingredient bullets
11. Blank line
12. `## Method`
13. Method numbered steps
14. Blank line
15. `## Notes` — optional
16. Notes bullets — optional
17. Blank line (if notes present)
18. Horizontal rule (`---`)
19. Tag line
20. Blank line
21. Footer (`✶ mise.app`)

No trailing newline after the footer (files end with `mise.app\n`, not `mise.app\n\n`).

---

## Reserved for v2

- `language: <ISO 639-1>` frontmatter field — when recipe-content translation ships
- Custom user-defined tag namespaces
- `version: 2` frontmatter field — only if format ever changes incompatibly
- Richer `via` vocabulary for translation provenance (`"translated from ko"`)

---

## Non-Goals

Things Mise deliberately does **not** put in the `.md`:

- Nutrition facts (derive at export-time tooling if needed; not Mise's job to compute/guess)
- Ratings / stars / reviews
- "You might also like" cross-promotion
- Affiliate links
- Any tracking metadata beyond `ticket` + `captured`
- Embedded images (Mise is plain text; images are the domain of the source page and the PDF render)
