# Recipe Archiver — Design Spec

## Overview

A lightweight web app that extracts recipes from any source — web pages, YouTube videos, Instagram posts, blog articles, or uploaded photos — and exports them as structured markdown files. Designed for people who manage their recipe collections in tools like Notion or Obsidian.

Stateless, no accounts. Light persistence via localStorage for recent extraction history.

## Architecture

Single Next.js application deployed to Vercel. One API route handles all extraction logic. Frontend is a single page.

```
┌─────────────────────────────────┐
│  Next.js App (Vercel)           │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │  Frontend  │  │ API Routes │  │
│  │            │  │            │  │
│  │ URL Input  │──▶ /extract   │  │
│  │ Img Upload │  │            │  │
│  │ Preview    │◀─│ 1. Fetch   │  │
│  │ Download   │  │ 2. Parse   │  │
│  │ History    │  │ 3. LLM     │  │
│  │ (localStorage)│            │  │
│  └───────────┘  └─────┬──────┘  │
│                       │         │
└───────────────────────┼─────────┘
                        │
              ┌─────────▼─────────┐
              │  Claude Haiku API  │
              │  (recipe parsing)  │
              └───────────────────┘
```

### API Route: `POST /api/extract`

**Input:** `{ url: string }` or `{ image: base64 string }`

**Processing:**
1. Determine source type
2. Fetch/extract raw content
3. Send to Claude Haiku with structured prompt
4. Return structured recipe JSON

**Output:**
```json
{
  "title": "string",
  "source": "string (URL or 'Photo upload')",
  "servings": "string | null",
  "prepTime": "string | null",
  "cookTime": "string | null",
  "ingredients": ["string"],
  "steps": ["string"],
  "notes": ["string | null"]
}
```

Fields that can't be determined are returned as `null` and omitted from the markdown output.

## Extraction Pipeline

### Source Detection & Strategy

| Source | Detection | Strategy |
|---|---|---|
| Web/blog | Default URL | Fetch HTML, strip to main content via readability |
| YouTube | `youtube.com`, `youtu.be` | Fetch description + captions via `youtube-transcript` |
| Instagram | `instagram.com` | Fetch post page, extract caption text (note: Instagram aggressively blocks scraping — may require fallback to user pasting caption text manually) |
| Image upload | File input (jpg/png/heic) | Send image to Claude vision API |
| Generic URL | Fallthrough | Attempt page scrape |

### Content Priority Chain (for URL sources)

1. **Structured data** — `ld+json` Recipe schema (many food blogs include this)
2. **Page description / caption / post body**
3. **Video transcript / captions**

If multiple sources yield content, all are concatenated and sent to the LLM for best results.

### LLM Parsing

- Model: Claude Haiku (text) / Claude Haiku with vision (images)
- System prompt defines exact JSON output schema
- Includes unit preference (metric or imperial) so measurements are converted at extraction time
- Raw text capped at 50,000 characters before sending

## Markdown Output Template

```markdown
# {Title}

> Source: {URL or "Photo upload"}
> Extracted: {date}

## Details
- **Servings:** {servings}
- **Prep time:** {prep_time}
- **Cook time:** {cook_time}

## Ingredients
- {ingredient_1}
- {ingredient_2}
- ...

## Steps
1. {step_1}
2. {step_2}
3. ...

## Notes
- {note_1}
- ...
```

Sections with no data are omitted entirely (no empty headings or "N/A" values).

## Frontend

### Single Page Layout

- **Input area:** URL text field + image upload button (camera-friendly on mobile)
- **Unit toggle:** Metric / Imperial, saved to localStorage, defaults to metric
- **Recipe preview:** Rendered markdown of the extracted recipe
- **Download button:** Saves the `.md` file with the recipe title as filename
- **Recent extractions:** List of last 20 extractions stored in localStorage (title, source, date, markdown content). Tapping one re-opens the preview for re-download.

### Mobile-First

The app must work well on mobile since a key use case is extracting recipes from Instagram or photographing cookbook pages on a phone.

## Cost Guardrails

| Control | Value |
|---|---|
| Rate limit | 10 extractions / hour / IP |
| Text input cap | 50,000 characters |
| Image upload cap | 5MB, single image |
| Model | Claude Haiku (cheapest tier) |
| Estimated cost/extraction | ~$0.001 (text), ~$0.005 (image) |

No auth means no per-user billing. Total spend controlled at the Anthropic API key level via usage limits.

## Configuration (localStorage)

- `unitPreference`: `"metric"` | `"imperial"` (default: `"metric"`)
- `recentExtractions`: array of last 20 extractions `{ title, source, date, markdown }`

## Creative Direction — "The Bear"

Inspired by the show's aesthetic: raw, utilitarian, professional kitchen energy.

### Visual Pillars

- **Industrial warmth** — dark, warm tones. Not sleek-dark-mode but dimly lit kitchen after hours.
- **Typography as texture** — gritty, slightly imperfect display font + clean mono/sans for recipe content (ticket printer feel).
- **Restraint with edge** — minimal UI, few elements but each has character. Warm accent color (flame orange or copper).
- **Functional, not decorative** — every element earns its place. Mise en place philosophy.

### Mood Keywords

Behind-the-scenes, intensity, craft, worn-in, honest, no-bullshit.

The `/design` skill will refine specific fonts, colors, and layout during implementation.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Deployment:** Vercel
- **LLM:** Claude Haiku API (via Anthropic SDK)
- **Scraping:** Cheerio + Mozilla Readability for HTML parsing
- **YouTube:** `youtube-transcript` package
- **Styling:** Tailwind CSS

## Out of Scope (MVP)

- Audio extraction from video (future enhancement)
- User accounts / authentication
- Server-side recipe storage
- Recipe collections / folders
- Sharing / public links
- Nutrition information extraction
