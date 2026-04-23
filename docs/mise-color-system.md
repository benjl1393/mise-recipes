# Mise — Color System

**Status:** v2 (2026-04-23) — pivoted from split-complementary warm-dominant to brutalist-with-flame
**Scheme:** Neutral monochrome + single accent family. Flame (hue 35°) is the only chromatic color in the system, applied sparingly. Everything else is a neutral gray scale.
**Color space:** OKLCH (perceptually uniform). All tokens defined in OKLCH; hex shown alongside where relevant.
**Source principles:** Design for Hackers Chapters 8–9, applied to Mise's *Industrial / kitchen-after-hours* brief with a deliberate anti-AI-aesthetic stance.

---

## The Pivot (v1 → v2)

v1 used a split-complementary scheme — flame + copper + ember warm family, against a warm-near-black background, with steel/slate as cool complements. It worked on paper and served the kitchen-metaphor brief, but it hit three signatures of the "AI-generated tasteful design" default:

1. Warm cream/oat background with dark-warm text
2. Orange/terracotta/rust accent family
3. High-coherence palette with 3+ related warm hues

The pivot removes 1 and 3. What remains: a neutral gray palette with flame as the single deliberate spark — *less color than the v1 system, more meaning when it appears*.

**What's retained from v1**: Departure Mono + Commit Mono type system (already anti-cliché — monospace-only, not serif+sans), the ticket/receipt structural metaphor, the .md-is-source principle, the typographic-role rule (chrome vs content).

**What's removed**: warm cream paper (replaced with neutral off-white), copper as a distinct hue (tags, frontmatter keys, links all become neutral gray), cool complements as text/surface colors (steel lives only in shadow), olive-green success as its own hue, amber warning as its own hue.

**What's kept as the single accent**: flame, its tonal variants (flame-bright / flame-deep), and ember as a darker step for the extraction badge. All in the same 35° hue family. Used on: Fire button, ✶ brand glyph, extraction badge, urgent states. That's it.

---

## Principles

### 1. One accent. Precious. Intentional.

Every appearance of flame means something. Fire button is flame because it's the primary action. The ✶ glyph is flame because it's the brand signature. The extraction-method badge is ember (darker flame) because it marks how much work Mise did to pull this recipe. Urgent states are flame-deep. Nothing else gets flame.

Per Kadavy Ch 9 Pattern 3: *"Pick one or two dominant colors; use others sparingly as accents to draw attention to specific elements."* Mise v2 is an extreme reading of this — one accent family, used maybe 3 times per card maximum.

### 2. Neutral scale does everything else.

Text has 4 weights (primary / secondary / dim / muted). Surfaces have 4 dark steps (ink-900 → ink-600) and 3 light steps (paper-50 → paper-200). Rules are mid-gray. None of these have hue — they're pure neutral on the L axis.

This is a commitment. Tags are gray. Frontmatter keys in the raw `.md` panel are gray. Source URLs are gray. Captions are gray. If it's data or metadata, it's some weight of gray. If it's brand or action, it's flame.

### 3. No pure black. No pure white.

Per Kadavy Ch 9: pure black "does not exist in nature." Even brutalist neutrals should have micro-variation. Our darkest (`--ink-900`) is `oklch(0.100 0 0)` — a 10% L neutral, not pure 0. Our brightest (`--paper-50`) is 98.5% L, not 100%. The scale breathes.

### 4. Shadow retains a hint of cool.

`--shadow` is `oklch(0.100 0.015 240 / 0.25)` — neutral-dark near-black with a tiny chroma shift toward blue-steel. Per Kadavy Ch 9 Pattern 2, hue-shifted shadows create richer depth than pure-black. The cool-shifted shadow on a paper card makes the card appear warmer and more forward. At 25% alpha the hue shift is barely perceptible as color — it reads as *depth*, not as blue.

### 5. Color as grammar, not decoration

Per the `.md` format spec's "Core principle — no invented styling": any typographic treatment (including color) in a rendered surface must correspond to a markup signal in the source. Tag hashtags are dim gray (matching body-text dim weight, because they're body-level metadata). The `✶` glyph is flame (because it's the brand stamp). The extraction badge is ember (because it marks how the capture was made). Nothing arbitrary.

---

## The Wheel Position

One hue, one family. Everything else is neutral.

```
        YELLOW
           |
           |
        ◆ flame-bright (hover)
           |
        ◆ flame (primary accent, Fire + ✶)
           |
        ◆ flame-deep (pressed, error text)
           |
        ◆ ember (extraction badge)
    ORANGE
           \
            \
             \          ← (no cool counterpart — shadow uses oklch 240° but only at 25% alpha)
              ───────── neutral axis (hue = null) ──────────
```

Hue 35° (orange-red) + achromatic grays. That's the whole palette.

---

## Token Reference

**29 → 16 tokens.** Simpler. Each token has a reason.

All OKLCH. Legacy token names (`--copper`, `--success`, etc.) are retained as aliases that resolve to neutral grays or flame-family, so existing CSS doesn't break during migration.

### Base surfaces — ink scale (neutral near-black)

| Token | OKLCH | Usage |
|---|---|---|
| `--ink-900` | `oklch(0.100 0 0)` | Deepest — shadow interiors, PDF provenance |
| `--ink-800` | `oklch(0.150 0 0)` | Panel darker, modal overlay |
| `--ink-700` | `oklch(0.200 0 0)` | **Primary dark bg** — popup surround, landing-page hero |
| `--ink-600` | `oklch(0.280 0 0)` | Raised dark panel, secondary backdrop |

### Base surfaces — paper scale (neutral off-white)

| Token | OKLCH | Usage |
|---|---|---|
| `--paper-50` | `oklch(0.985 0 0)` | Near pure white — PDF page bg |
| `--paper-100` | `oklch(0.965 0 0)` | **Primary card bg** — popup ticket |
| `--paper-200` | `oklch(0.920 0 0)` | Pale gray — inset panels, subtle divider surfaces |

### Ink on paper (neutral text on bone)

| Token | OKLCH | Contrast on `--paper-100` | Usage |
|---|---|---|---|
| `--ink-primary` | `oklch(0.120 0 0)` | 18.3:1 ✅ AAA | Body, title, primary content |
| `--ink-secondary` | `oklch(0.280 0 0)` | 13.2:1 ✅ AAA | Section heading rule, secondary stamps |
| `--ink-dim` | `oklch(0.480 0 0)` | 5.9:1 ✅ AA | Dim body — source URL, facts labels, tag hashtags, frontmatter keys |
| `--ink-muted-v2` | `oklch(0.620 0 0)` | 3.3:1 ⚠️ large-only | Placeholder, disabled states |
| `--rule-cream` | `oklch(0.820 0 0)` | — | Hairline rules on paper (not text) |

### Paper on ink (neutral text on dark)

| Token | OKLCH | Contrast on `--ink-700` | Usage |
|---|---|---|---|
| `--paper-primary` | `oklch(0.965 0 0)` | 16.4:1 ✅ AAA | Body on dark, landing hero |
| `--paper-dim` | `oklch(0.780 0 0)` | 9.0:1 ✅ AAA | Secondary on dark |
| `--paper-muted` | `oklch(0.620 0 0)` | 5.0:1 ✅ AA | Captions, faint labels on dark |
| `--rule-ink` | `oklch(0.280 0 0)` | — | Hairline rules on dark |

### Heat — the single accent family

| Token | OKLCH | Usage |
|---|---|---|
| `--flame` | `oklch(0.596 0.190 35.1)` | Fire button bg, ✶ brand glyph, warning text |
| `--flame-bright` | `oklch(0.650 0.183 36.9)` | Fire button hover (+0.054 L, same H) |
| `--flame-deep` | `oklch(0.515 0.163 35.1)` | Fire button pressed; error text (−0.081 L). 5.5:1 AA on paper-100 |
| `--ember` | `oklch(0.436 0.129 35.8)` | Extraction-badge bg (with paper-100 text). 7.6:1 AAA |

Perceptually uniform L progression: ember (0.436) → flame-deep (0.515) → flame (0.596) → flame-bright (0.650). ~0.06 L between each step. Easy to derive more stops if needed.

### Functional — minimal

| Token | Value | Usage |
|---|---|---|
| `--error` | `var(--flame-deep)` | Error text. Uses flame-deep because it's readable on cream AA and carries warmth without competing with `--flame` as primary action |
| `--error-soft` | `oklch(0.940 0.025 30)` | Error callout bg — pale warm tint, faint enough that flame-deep text on it still reads cleanly |

**Success has no dedicated color.** Success callouts use `--paper-200` bg + `✓` glyph + `--ink-primary` text. The ✓ carries the meaning; color isn't needed.

**Warning has no dedicated color.** Warning uses flame (same as urgent) — severity differentiated by `⚠` glyph and text label, not hue.

### Shadow — faint cool tint

| Token | Value | Usage |
|---|---|---|
| `--shadow` | `oklch(0.100 0.015 240 / 0.25)` | Popup drop shadow. Neutral-dark with tiny blue-steel hue shift (reads as depth, not color). |
| `--shadow-soft` | `oklch(0.100 0.015 240 / 0.12)` | Subtle hover lift |

### Retired tokens (preserved as aliases for back-compat)

| Legacy name | Resolves to | Note |
|---|---|---|
| `--copper` | `var(--ink-dim)` | Was warm metal. Now neutral gray. Tags and frontmatter keys still work but render as dim gray text. |
| `--copper-deep` | `var(--ink-primary)` | Was deeper copper. Now near-black. |
| `--steel` | `oklch(0.267 0.018 241.8)` | Preserved for shadow-token calculations only. Not a foreground color. |
| `--slate` | `var(--ink-dim)` | Was cool gray. Absorbed into ink-dim. |
| `--success` | `var(--ink-dim)` | Was olive. Success states don't need a unique hue. |
| `--success-soft` | `var(--paper-200)` | Success callout bg. |
| `--warning` | `var(--flame)` | Was amber. Now shares flame with urgent; severity via `⚠` + text. |

---

## Contrast Verification (WCAG 2.1)

Recomputed for the v2 neutral palette. AA normal = 4.5:1; AAA normal = 7.0:1; AA large = 3.0:1.

| Foreground | Background | Ratio | Status | Role |
|---|---|---|---|---|
| `--ink-primary` | `--paper-100` | 18.3 | ✅ AAA | Body |
| `--ink-secondary` | `--paper-100` | 13.2 | ✅ AAA | Heading rule |
| `--ink-dim` | `--paper-100` | 5.9 | ✅ AA | Dim body, tags, source URL |
| `--ink-muted-v2` | `--paper-100` | 3.3 | ⚠️ large-only | Placeholder / disabled |
| `--paper-primary` | `--ink-700` | 16.4 | ✅ AAA | Body on dark |
| `--paper-dim` | `--ink-700` | 9.0 | ✅ AAA | Secondary on dark |
| `--paper-muted` | `--ink-700` | 5.0 | ✅ AA | Caption on dark |
| `--ember` | `--paper-100` | 7.6 | ✅ AAA | Extraction badge |
| `--flame-deep` (= error) | `--paper-100` | 5.5 | ✅ AA | Error text on cream |
| `--flame` | `--paper-100` | 4.0 | ⚠️ large-only | Fire button label |
| `--flame` | `--ink-700` | 4.1 | ⚠️ large-only | ✶ glyph on dark |

**Improvements over v1:**
- Error text now passes AA on cream (5.5:1) using the same hue family as flame, no separate red needed.
- `--ink-dim` contrast improved (5.4 → 5.9) via the neutral shift.
- `--paper-dim` contrast improved (8.9 → 9.0).

**Flame button label** remains the same AA-large-text boundary case. Mitigation options unchanged: bump button text to 14pt, load Commit Mono 700 for bold, or accept the large-button-label spirit. Decide at `impeccable:layout`.

---

## Application Rules

### Popup card (cream surface)

```
surface                  --paper-100
body text                --ink-primary
secondary text           --ink-dim
subtitle (italic)        --ink-dim
source URL               --ink-dim
facts labels             --ink-dim
facts values (bold)      --ink-primary
extraction badge bg      --ember (the one darker-warm tonal step)
extraction badge text    --paper-100
section heading          --ink-primary (Departure Mono)
section heading rule     --ink-primary
ingredient qty           --ink-primary
ingredient item          --ink-primary
ingredient dotted rule   --rule-cream
method counter           --ink-dim
method body              --ink-primary
method solid rule        --rule-cream
tag hashtag              --ink-dim (NEUTRAL, not colored)
tag dot separator        --ink-dim
ticket-top text          --ink-primary / --ink-dim
ticket-top rule          --rule-cream
ticket-bottom text       --ink-dim
✶ glyph                  --flame                    ← the single accent moment
mise.app text            --ink-dim
drop shadow              --shadow (steel-tinted rgba)

Fire button bg           --flame                    ← the single accent moment
Fire button text         --paper-100
Fire button hover        --flame-bright
Fire button pressed      --flame-deep
Prep button border       --ink-600
Prep button text         --paper-primary
```

Flame appearances per card (happy path): 2 — extraction badge (ember technically, same hue) + ✶ glyph + Fire button. Three tonal spots. Everything else neutral.

### Error state (In the Weeds)

```
callout bg               --error-soft
callout left border      --flame-deep (3px)
label text               --flame-deep
body text                --ink-primary
```

### Success state (Fired)

```
callout bg               --paper-200
callout left border      --ink-dim (3px)
label text               --ink-primary (with ✓ glyph)
body text                --ink-primary
```

No color. The ✓ carries the meaning.

### Warning state (Low Confidence)

```
callout bg               --paper-100
callout left border      --flame (3px)
label text               --flame (with ⚠ glyph)
body text                --ink-primary
```

Shares flame with urgent/error. Severity signaled by `⚠` glyph, not a distinct hue.

### PDF page

Same mapping, `--paper-50` as canvas instead of `--paper-100`.

### Dark surfaces (The Pass, landing hero)

```
surface                  --ink-700
body text                --paper-primary
dim text                 --paper-dim
muted text               --paper-muted
hairline rule            --rule-ink
✶ glyph                  --flame
```

---

## Why This Palette (v2 rationale)

### Per Chapter 9 — Color Theory

**Muted/sophisticated mood, extremified.** Ch 9's "Muted/Sophisticated" pattern uses "low saturation + neutral dominant + one strong accent." Mise v2 pushes this to its limit — not low saturation, *no* saturation for the dominant, and one accent. The result is Criterion-Collection-register restraint applied to the kitchen brief.

**Red psychology — food & service contexts.** Ch 9: red drives action in food and sales contexts; overloads the prefrontal cortex in analytical contexts. Mise is a capture tool, not a performance tool — flame is on-brand. A single deep flame on a neutral card reads as urgency + appetite without the fatigue of warm-everything.

**Warm/cool relationships.** Ch 9 Pattern 1: primary text warm-dark, secondary cool. v1 did this with warm text + warm cream. v2 uses *neutral* text on *neutral* paper with flame as the only warm moment. The warm/cool relationship is now binary — flame is warm, everything else is neutral. Kadavy's rule still honored (warm pops, neutral recedes), but with maximum discipline.

**Shadow hue-shift (Ch 9 Pattern 2).** Retained from v1: `--shadow` uses a tiny blue-steel hue shift at low alpha. On a neutral system this matters more, not less — the card's paper is neutral, so the shadow's micro-cool cast makes the card read as very slightly warmer by contrast. Brutalist in absolute terms, still tonally alive.

### Per Chapter 8 — Color Science

**OKLCH throughout.** Canonical source form. Hex computed from OKLCH via standard CSS Color 4 transform. Perceptual uniformity means scale steps feel even; hue-preserving L shifts (flame → flame-bright) are mechanical not eyeballed.

**Colorblindness safety.** Meaning never relies on color alone:
- Success: ✓ glyph + position (callout shape) + text label
- Error: ⚠ glyph + flame border + text label
- Warning: ⚠ glyph + flame (lighter border weight than error) + text label
- Extraction badge: 🎬 / 📝 / 📜 emoji glyphs + text

Protanopia/deuteranopia simulation recommended at `impeccable:critique`.

### Anti-AI Stance

Mise v2 explicitly rejects three signatures of AI-generated "tasteful design":

1. ~~Warm cream/oat background with dark-warm text~~ → neutral off-white with neutral near-black
2. ~~Orange/terracotta/rust accent family~~ → single flame, used sparingly; no copper, no multiple warm hues
3. ~~Serif display + geometric sans body~~ → already Departure Mono + Commit Mono (monospace, committed)

The result should read as *specific design judgment*, not *safe middle-ground*. If it feels austere, it's working.

---

## Reserved for Future

- **Dark-mode mirror.** If Mise adds a "kitchen lights out" mode flipping card-dark / text-cream, a `--card-dark` token and mirror text-on-dark-card scale are needed. Out of v1 scope.
- **Seasonal accent.** A promotional campaign might want a secondary accent (holiday red vs flame orange-red, say). The current system reserves one accent slot — expanding would need explicit consideration.
- **Print calibration.** The `--paper-50` at oklch(0.985 0 0) may be too bright for some thermal printers / matte paper stock. A `--paper-print` (slightly lower L, slightly warm) may be useful when cross-media testing real prints.

---

## Tokens — copy-paste CSS

```css
:root {
  /* Base surfaces — neutral scale */
  --ink-900: oklch(0.100 0 0);
  --ink-800: oklch(0.150 0 0);
  --ink-700: oklch(0.200 0 0);
  --ink-600: oklch(0.280 0 0);

  --paper-50:  oklch(0.985 0 0);
  --paper-100: oklch(0.965 0 0);
  --paper-200: oklch(0.920 0 0);

  /* Ink on paper */
  --ink-primary:   oklch(0.120 0 0);
  --ink-secondary: oklch(0.280 0 0);
  --ink-dim:       oklch(0.480 0 0);
  --ink-muted-v2:  oklch(0.620 0 0);
  --rule-cream:    oklch(0.820 0 0);

  /* Paper on ink */
  --paper-primary: oklch(0.965 0 0);
  --paper-dim:     oklch(0.780 0 0);
  --paper-muted:   oklch(0.620 0 0);
  --rule-ink:      oklch(0.280 0 0);

  /* Heat — single accent family, used sparingly */
  --flame:        oklch(0.596 0.190 35.1);
  --flame-bright: oklch(0.650 0.183 36.9);
  --flame-deep:   oklch(0.515 0.163 35.1);
  --ember:        oklch(0.436 0.129 35.8);

  /* Functional */
  --error:      var(--flame-deep);
  --error-soft: oklch(0.940 0.025 30);

  /* Shadow — faint cool tint */
  --shadow:      oklch(0.100 0.015 240 / 0.25);
  --shadow-soft: oklch(0.100 0.015 240 / 0.12);
}
```

### Browser support

OKLCH is supported in Chrome 111+, Safari 15.4+, Firefox 113+ — well within Mise's targets.
