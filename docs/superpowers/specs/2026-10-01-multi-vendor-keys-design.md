# Multi-vendor API keys — design

**Date:** 2026-10-01 · **Branch:** `worktree-multi-vendor-keys` · **Status:** approved for planning
(technical review by a reviewer agent in Ben's place, at his request; findings folded in)

## Why

Mise is going on the portfolio with a "Try it" section. A reader who has an
OpenAI or Gemini key and no Anthropic key must be able to install it and fire
a recipe. Ben, 2026-10-01: *"we need to build it so that users add their own
api key … regardless of ai vendor."* This schedules the feature `CLAUDE.md`
parked on 2026-08-17 under "Deferred to launch — multi-provider keys".

Nothing about the zero-backend model changes. The key lives in
`chrome.storage.local` and goes from the popup straight to the vendor.

## Decisions (Ben's, 2026-10-01)

1. **Scope:** Anthropic through its native Messages API, plus **one** adapter
   for the OpenAI Chat Completions shape at a configurable base URL. Presets for
   OpenAI, Gemini, Grok (xAI), Mistral and OpenRouter, and a **Custom** option
   for anything else that speaks the same shape, including keyless local servers.
2. **Model picker:** keep the two-option menu, relabelled **Fast / Thorough**.
   Each preset maps the two to its own models. Custom shows a Model ID field.
3. **Build approach:** our own thin adapter over plain `fetch`. No new
   dependencies. The Anthropic SDK stays for the Anthropic path.

Engineering detail below was delegated ("please be the judge here").

## Non-goals

- Storing a key per vendor. One key at a time; switching vendor means pasting
  a different key.
- OpenAI's Responses API, streaming, tool use.
- Falling back automatically from `json_schema` to `json_object` mode.
- Automatic retries on the fetch path (see Errors → Retries).
- Making the repo public, a Release zip, a store listing. Separate tasks.

## Prep — what the user sees

`#prep-form` gets `novalidate`. Validation happens in `save()`, so a malformed
URL produces the status-line message below rather than a native bubble, and a
hidden field can never block Save.

Field order, top to bottom:

1. **API key** (`password`). Label "API key", placeholder "Paste your key".
2. **Provider** (`select`, `id="provider"`): Anthropic, OpenAI, Gemini, Grok,
   Mistral, OpenRouter, Custom (OpenAI-compatible).
3. **Base URL** (`url`, `id="baseURL"`) and **Model ID** (`text`,
   `id="customModel"`). Always rendered, `hidden` unless Provider is Custom.
4. **Model** (`select`, `id="tier"`): "Fast — cheapest per recipe" /
   "Thorough — slower, best on messy sources". `hidden` when Provider is Custom.
5. Units, Scan video frames, Pulse the icon — unchanged, except the Units hint
   says "Mise converts by ingredient density, not naive math."

**Wiring.** One function, `sync()`, owns everything derived: the key hint,
which fields are hidden. It runs on mount (after the stored values are
loaded), on the provider menu's `change`, and on the key field's `input`.
Setting `select.value` from script fires no `change` event, so nothing may
rely on one.

On key `input`, before `sync()`: `d = detectProvider(value)`; if `d` is not
null **and the menu is not on Custom**, set the menu to `d`. Detection never
moves the menu off Custom, because several OpenAI-compatible vendors issue
`sk-` keys.

**The key hint** (under the key field), computed by `sync()`:

| state | hint |
|---|---|
| key empty, any preset | Stored on this device only. Works with Anthropic, OpenAI, Gemini, Grok, Mistral, OpenRouter, or any OpenAI-compatible API. |
| key present, `detectProvider` null, preset selected | Couldn't tell which provider this key is for. Pick it below. |
| preset | Stored on this device only. Sent to {host} and nowhere else. No key yet? [Make one at {label}]({keyUrl}). You pay {label} directly. |
| Custom | Stored on this device only. Sent to {host of Base URL, or "the base URL below" while it is empty} and nowhere else. Leave it empty if your server needs no key. |

The "couldn't tell" row is driven by one boolean, `undetected`: key `input`
sets it to `key.trim() !== "" && detectProvider(key) === null`; a provider
`change` sets it to `false`; mount sets it to `false`. So it shows right after
an unrecognised key is pasted, and gives way to the preset row as soon as the
user picks a provider. It never shows on Custom.

**Save** writes exactly
`{ apiKey, provider, tier, baseURL, customModel, units, captureFrames }`
(`pulseOnDetect` keeps writing on its own change, as today). The Custom
fields are persisted even when hidden, so switching away and back loses
nothing. `baseURL` is normalised before writing: trimmed, trailing slashes
removed, and a trailing `/chat/completions` removed. When Provider is Custom,
Save refuses an empty `baseURL`, one that does not parse as a `http:` or
`https:` URL, or an empty `customModel`, and the status line says "Custom
needs a base URL and a model ID." Nothing is written in that case.

**Styling.** The Prep block in `extension/scripts/port-design.mjs` styles
`input[type="password"]` and `select`; extend that selector to
`input[type="text"]` and `input[type="url"]`, then `npm run port:design`.
Never hand-edit `popup.css`. No new classes, so `audit:ext` must not grow.

## Architecture

```
extension/src/lib/
  extract.ts              RECIPE_SCHEMA, buildPrompt, OffMenuError,
                          extractRecipe, toNullableSchema, validateOutput,
                          sampleFrames   (vendor-independent)
  providers/
    presets.ts            ProviderId, Tier, Preset, PRESETS, PROVIDER_IDS,
                          CUSTOM_DEFAULTS, detectProvider, normalizeBaseURL
    connection.ts         Connection, resolveConnection(settings)
    errors.ts             ProviderError, ProviderErrorKind, readErrorBody,
                          classifyResponse
    anthropic.ts          callAnthropic(conn, request, client?)
    openai-compat.ts      callOpenAICompat(conn, request, fetchImpl?)
```

`lib/anthropic.ts` is deleted; its contents split between `extract.ts` and
`providers/anthropic.ts`. Callers and tests that change:

- `src/popup/popup.ts` (import, the `NoKeyError` check, `resolveConnection`,
  frame sampling, the `extractRecipe` call);
- `src/popup/views/prep.ts` (reads and writes `settings.model` today, lines 98
  and 119);
- `src/popup/errors.ts` (rewritten around `ProviderError`);
- `scripts/portfolio/render-portfolio.mjs:49`, which builds the portfolio's
  error image from `classify({ status: 529 })` and must build a
  `ProviderError` instead;
- `tests/anthropic.test.ts` (becomes `tests/extract.test.ts`),
  `tests/errors.test.ts` (status and regex cases, the "CLAUDE OVERLOADED"
  literal), `tests/storage.test.ts` (the `model` default), and both files in
  `tests/live/`.

`manifest.json` does **not** change: `https://*/*` and `http://*/*` already
cover every vendor host and any http Custom host, and `manifest.test.ts`
pins the list. `providers/` must stay out of `src/embed`'s import graph;
`build-embed.test.ts` fails the build on any `sk-ant-` literal in the embed
bundle, and `presets.ts` contains one.

### Types

```ts
type ProviderId = "anthropic" | "openai" | "gemini" | "xai" | "mistral" | "openrouter" | "custom";
type Tier = "fast" | "thorough";

interface Preset {
  id: Exclude<ProviderId, "custom">;
  label: string;          // "OpenAI" — used in Prep and error copy
  host: string;           // "api.openai.com" — Prep hint, network error
  keyUrl: string;         // where to make a key
  keyPrefixes: string[];  // for detectProvider
  protocol: "anthropic" | "openai";
  baseURL: string;        // unused for anthropic (SDK default)
  models: Record<Tier, string>;
  maxImages: number;
  tokenParam: "max_tokens" | "max_completion_tokens";
  strict: boolean;        // send json_schema.strict = true
  extraBody: Record<string, unknown>;
}

interface Connection {
  provider: ProviderId; label: string; host: string;
  protocol: "anthropic" | "openai";
  baseURL: string; apiKey: string; model: string;
  maxImages: number; tokenParam: Preset["tokenParam"];
  strict: boolean; extraBody: Record<string, unknown>;
}

interface ModelRequest {
  prompt: string;
  frames: string[];       // already sampled to conn.maxImages
  schema: object;         // RECIPE_SCHEMA, or its nullable rewrite
  maxTokens: number;      // 8000, as today
}
```

`resolveConnection(settings)` is pure. For a preset it copies the preset and
picks `models[settings.tier]`. For Custom it uses `CUSTOM_DEFAULTS`
(`protocol: "openai"`, `maxImages: MAX_FRAMES`, `tokenParam: "max_tokens"`,
`strict: false`, empty `extraBody`), `normalizeBaseURL(settings.baseURL)` and
`settings.customModel`, with `label: "Your provider"` and `host` taken from
the URL. A Custom connection missing either field throws a plain `Error`
("A custom provider needs a base URL and a model ID. Open Prep to add them."),
which the generic error branch shows as written. Save validation makes that
unreachable in practice, so it gets no dedicated copy.

`popup.ts` order:

1. `getSettings()`.
2. `if (!settings.apiKey && settings.provider !== "custom") throw new NoKeyError()`.
   Custom may be keyless (a local server).
3. `const connection = resolveConnection(settings)`, before the tab query and
   frame capture, so a configuration error never costs a capture.
4. After capture, `frames = sampleFrames(frames, connection.maxImages)`
   **before** `payload.via` is set to "{n} video frames", so the `.md` records
   the frames the model actually saw.
5. `extractRecipe(payload, { connection, units, frames })`.

### Presets

Model IDs and request quirks were read from each vendor's docs on 2026-10-01
(research drawer `drawer_code_recipe_archiver_a364eba8a02a61f0b89b703b`).

| id | label | host | Fast | Thorough | maxImages | tokenParam | strict | extraBody |
|---|---|---|---|---|---|---|---|---|
| anthropic | Anthropic | api.anthropic.com | `claude-haiku-4-5` | `claude-opus-5-5` | 24 | max_tokens (unused) | false (unused) | `{}` |
| openai | OpenAI | api.openai.com | `gpt-6-luna` | `gpt-6.1-sol` | 24 | max_completion_tokens | true | `{ reasoning_effort: "low" }` |
| gemini | Gemini | generativelanguage.googleapis.com | `gemini-3.5-flash-lite` | `gemini-3.8-flash` | 24 | max_tokens | false | `{ reasoning_effort: "low" }` |
| xai | Grok | api.x.ai | `grok-4.3` | `grok-4.7` | 24 | max_completion_tokens | false | `{}` |
| mistral | Mistral | api.mistral.ai | `mistral-small-latest` | `mistral-medium-latest` | 8 | max_tokens | false | `{}` |
| openrouter | OpenRouter | openrouter.ai | `google/gemini-3.5-flash-lite` | `anthropic/claude-opus-5.5` | 24 | max_tokens | true | `{ provider: { require_parameters: true } }` |

Base URLs: `https://api.openai.com/v1`,
`https://generativelanguage.googleapis.com/v1beta/openai`,
`https://api.x.ai/v1`, `https://api.mistral.ai/v1`,
`https://openrouter.ai/api/v1`. The adapter appends `/chat/completions`.

`reasoning_effort: "low"` rather than `"none"`/`"minimal"`: Gemini 3.8 Flash
rejects `minimal`, and `low` is accepted by both. Extraction gains nothing
from long reasoning, and the card waits on it.

Key URLs: `https://console.anthropic.com/settings/keys`,
`https://platform.openai.com/api-keys`,
`https://aistudio.google.com/app/apikey`, `https://console.x.ai`,
`https://console.mistral.ai/api-keys`, `https://openrouter.ai/settings/keys`.

### detectProvider

Trims the key, then an ordered prefix match, first wins:

| prefix | provider |
|---|---|
| `sk-ant-` | anthropic |
| `sk-or-` | openrouter |
| `xai-` | xai |
| `AIza`, `AQ.` | gemini |
| `sk-` (incl. `sk-proj-`) | openai |
| anything else, or empty | `null` |

Order matters: `sk-ant-` and `sk-or-` must be tested before bare `sk-`.
Mistral keys have no prefix, so they return `null` by design.

### normalizeBaseURL

`trim()`, strip trailing `/`s, strip a trailing `/chat/completions`, strip
trailing `/`s again. Used by Save and by `resolveConnection`.

## Settings and migration

```ts
interface Settings {
  apiKey: string;
  provider: ProviderId;   // default "anthropic"
  tier: Tier;             // default "fast"
  baseURL: string;        // default ""
  customModel: string;    // default ""
  units: Units; captureFrames: boolean; pulseOnDetect: boolean;
}
```

`model` is removed. `getSettings` decides everything on the **raw** stored
object, before merging defaults, because after the merge `provider` and
`tier` always exist:

1. `raw = stored[KEY_SETTINGS] ?? {}`.
2. If `raw.provider` is absent and `raw.model` is a string, migrate:
   `provider = "anthropic"`, `tier = raw.model.includes("opus") ? "thorough" : "fast"`.
3. `settings = { ...DEFAULTS, ...rest-of-raw-without-model, ...migrated }`.
   The returned object never carries `model`, so the next `setSettings`
   writes the new shape.
4. Dev seed: if `settings.apiKey` is empty, the seed is non-empty, and
   `settings.provider !== "custom"`, set `apiKey = seed` and
   `provider = detectProvider(seed) ?? settings.provider`. The provider
   follows the seeded key, so a migrated "anthropic" can never sit beside a
   seeded OpenAI key.

## Request construction

`extractRecipe(payload, { connection, units, frames = [], transport? })`:

1. `frames = sampleFrames(frames, connection.maxImages)` (a no-op when
   `popup.ts` already sampled).
2. `schema = protocol === "anthropic" ? RECIPE_SCHEMA : toNullableSchema(RECIPE_SCHEMA)`.
3. Dispatch to `callAnthropic` or `callOpenAICompat`; each returns the parsed
   JSON object or throws `ProviderError`.
4. `validateOutput(raw, connection)`.
5. `found === false` or zero ingredients → `OffMenuError`, as today.
6. Build the `Recipe` exactly as today (`normalizeTags` included).

`transport` (`{ fetch?: typeof fetch; anthropic?: AnthropicLike }`) exists
only so tests can inject fakes.

### sampleFrames

`sampleFrames(frames, max)`: if `frames.length <= max` return `frames`
unchanged. Otherwise return `max` frames at indices
`Math.round(i * (frames.length - 1) / (max - 1))` for `i` in `0..max-1`
(first and last kept, order preserved). `max === 1` returns the middle frame.

### toNullableSchema

Returns a new schema in which every object's `required` lists **all** its
properties, and each property that was optional becomes nullable: a `type`
of `"string"` becomes `["string", "null"]`, an `"array"` becomes
`["array", "null"]`. Recurses into `properties` and `items`. Never mutates
`RECIPE_SCHEMA`. For our schema that is five nullable fields: `subtitle`,
`author`, `hands_on`, `total`, `notes`. This is what OpenAI strict mode
requires; Gemini and xAI document nullable type arrays. Mistral does not
document its rules; the live test settles it.

The Anthropic path keeps the original schema. It works today.

### callAnthropic

Today's call, moved: SDK client with `dangerouslyAllowBrowser` and the
`anthropic-dangerous-direct-browser-access` header, `messages.parse` with
`output_config.format`, images as base64 blocks before the text. Returns
`parsed_output`. Before returning, `stop_reason === "max_tokens"` → kind
`truncated`; a null `parsed_output` → `malformed`. Errors are converted:

- `APIConnectionTimeoutError` → `timeout`; `APIConnectionError` (no status,
  "Connection error.") → `network`;
- an `AnthropicError` whose message starts "Failed to parse structured
  output" → `malformed`;
- an `APIError` with a status → `classifyResponse(status, body)`.

Check `APIConnectionTimeoutError` before `APIConnectionError`; it is a
subclass.

### callOpenAICompat

`POST {baseURL}/chat/completions`, `Content-Type: application/json`, and
`Authorization: Bearer {key}` **only when the key is non-empty**.
`signal: AbortSignal.timeout(120_000)`. Body:

```ts
{
  model,
  messages: [{ role: "user", content: frames.length === 0
    ? prompt                                   // plain string: widest compatibility
    : [
        ...frames.map(b64 => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } })),
        { type: "text", text: prompt },
      ] }],
  response_format: { type: "json_schema",
    json_schema: { name: "recipe", schema, ...(strict ? { strict: true } : {}) } },
  [tokenParam]: maxTokens,
  ...extraBody,
}
```

Response handling:

- fetch rejects with a `TimeoutError` (`DOMException`) → `timeout`; any
  other rejection → `network`.
- non-2xx → `classifyResponse(status, parsedBodyOrText)`.
- 2xx whose JSON body has an `error` field (OpenRouter reports some failures
  inside a 200) → `classifyResponse(error.code if numeric else 502, body)`.
- `choices[0].finish_reason === "length"` → `truncated`.
- `choices[0].message.refusal` non-empty → `malformed`, refusal as detail.
- `choices[0].message.content` not a string, or not parseable JSON →
  `malformed`.
- otherwise return the parsed object.

### validateOutput

Hand-written, no schema library. Requires `found: boolean`. When `found` is
true it requires `title` and `serves` strings; `ingredients` an array of
`{ qty: string, item: string }`; `method` and `tags` arrays of strings.
`subtitle`, `author`, `hands_on`, `total` may be a string, `null` or absent;
`notes` an array of strings, `null` or absent. Every `null` becomes
`undefined`. When `found` is false nothing else is checked. Anything else
throws `ProviderError` of kind `malformed`. It runs on both paths.

## Errors

```ts
type ProviderErrorKind =
  "auth" | "billing" | "rate" | "overloaded" | "rejected" | "server"
  | "network" | "timeout" | "truncated" | "malformed";

class ProviderError extends Error {
  kind; label; host; status: number | null; detail: string;
  model: string; custom: boolean; url: string;   // url = the full endpoint called
}
```

Each adapter classifies; `popup/errors.ts` maps kinds to copy and never sees
a raw status.

`readErrorBody(body)` pulls `{ message, code }` out of any of the shapes the
vendors use: `{ error: { message, code, type } }` (OpenAI, OpenRouter,
Anthropic), `[{ error: { message, status } }]` (Gemini), `{ code, error: "…" }`
(xAI), `{ detail: "…" | [...] }` (Mistral). Unknown shapes or plain text fall
back to the raw text, truncated to 200 characters.

`classifyResponse(status, body)`, first match wins:

| condition | kind |
|---|---|
| 401, 403 | auth |
| 402; or code `insufficient_quota` at any status; or 400 with message matching `/credit balance\|billing/i` (Anthropic's low-balance 400) | billing |
| 400 with message matching `/api[ _-]?key/i` (Gemini and xAI answer a bad key with 400) | auth |
| 429 | rate (Gemini's per-minute 429 mentions "quota" and "billing"; it is still a rate limit) |
| 503, 529 | overloaded |
| any other 5xx | server |
| any other 4xx (400, 404, 408, 409, 410, 413, 422, …) | rejected |

The pattern `invalid.*key` is deliberately absent: OpenAI's strict-schema 400
("…every key in properties…") would match it and read as a bad key.

### Copy (`popup/errors.ts`)

Labels stay short and vendor-free; bodies name the vendor. `{switch}` is
"switch between Fast and Thorough in Prep" for a preset and "try another
model in Prep" for Custom.

| kind | label | code | body | retry |
|---|---|---|---|---|
| auth | KEY REJECTED | HTTP {status} | {label} refused that key. Check it in Prep: it may be revoked, mistyped, or for a different provider. | no |
| billing | OUT OF CREDIT | HTTP {status} | {label} says this account is out of credit. Top it up, then retry. | yes |
| rate | RATE LIMITED | HTTP 429 | You've hit your {label} rate limit. Wait a moment, then retry. | yes |
| overloaded | OVERLOADED | HTTP {status} | {label}'s servers are busy. Retry in about 30 seconds, or {switch}. | yes |
| rejected, 404, preset | REQUEST REJECTED | HTTP 404 | {label} doesn't serve the model {model}. Check Prep. | no |
| rejected, 404, Custom | REQUEST REJECTED | HTTP 404 | Nothing answered at {url}. Check the base URL in Prep; it usually ends in /v1. | no |
| rejected, other | REQUEST REJECTED | HTTP {status} | {label} rejected the request. {detail} | no |
| server | UPSTREAM ERROR | HTTP {status} | {label} had a server error. Retry in a moment. | yes |
| network | NETWORK DROP | OFFLINE | Couldn't reach {host}. Check your connection, then retry. | yes |
| timeout | TIMED OUT | TIMEOUT | {label} didn't answer within 2 minutes. Retry, or {switch}. | yes |
| truncated | REPLY CUT OFF | LENGTH | {label} ran out of room before the recipe was finished. Retrying won't help; {switch}. | no |
| malformed | PARSE FAILURE | BAD SHAPE | {label}'s reply didn't match the recipe shape. Retrying usually fixes it, or {switch}. | yes |

`NoKeyError` body becomes "Mise needs an API key from your AI provider. Open
Prep, paste it in, and fire again." `PAGE UNREADABLE` and the generic fallback
are unchanged. The old status switch and the message-regex branches for
network and parse failures are removed; `ProviderError` carries the kind.

The label "CLAUDE OVERLOADED" becomes "OVERLOADED". The specimen's 03C card
(`type-specimens/popup-states.html`, around line 1749) shows that label and
its body, so the specimen text is updated in the same change ("OVERLOADED",
"Anthropic's servers are busy. Retry in about 30 seconds, or switch between
Fast and Thorough in Prep."). The specimen's annotation rows that mention
"Claude call" are documentation, not product copy, and stay.

### Retries

The Anthropic SDK retries twice by default (429, 5xx, connection errors).
That ships today and is kept. The fetch path makes one attempt; the error
card's RETRY is the retry. The asymmetry is deliberate: no vendor on the
fetch path has yet shown a flakiness that would justify retry logic of our
own, and a silent retry doubles the wait on a stalled server.

## Testing

**Unit (`npm run test:ext`, mocked, no network):**

- `detectProvider`: table-driven, including order (`sk-ant-`, `sk-or-` before
  `sk-`), `AQ.`, leading whitespace, an unprefixed Mistral-shaped key → `null`,
  empty → `null`.
- `normalizeBaseURL`: trailing slash, trailing `/chat/completions`, both.
- `toNullableSchema`: every object lists all properties as required; exactly
  the five optional fields become nullable; `RECIPE_SCHEMA` is deep-equal to a
  snapshot taken before the call.
- `validateOutput`: nulls become undefined; a missing `title`, a non-array
  `ingredients`, a non-boolean `found` each throw `malformed`; `found: false`
  with empty fields passes.
- `sampleFrames`: under cap unchanged (same array); 24 → 8 keeps first and
  last, evenly spaced, order preserved; `max` 1.
- `resolveConnection`: each preset × tier; Custom; Custom with a
  `/chat/completions` URL; Custom missing a field throws.
- `callOpenAICompat` with an injected `fetch`: URL, auth header present only
  with a key, token param name, `strict` only where set, `extraBody` merged,
  plain-string content without frames, image parts before text with frames;
  a 200 carrying `error`; `finish_reason: "length"`; a refusal; content that
  is not JSON; a fetch `TimeoutError`; a fetch `TypeError`.
- `callAnthropic` with an injected client: `APIConnectionError`,
  `APIConnectionTimeoutError`, the structured-output parse error, a status
  error, `stop_reason: "max_tokens"`, a null `parsed_output`.
- `classifyResponse`: one fixture per vendor body shape, using the bodies the
  research probes returned (OpenAI 401 `invalid_api_key`, Gemini 400 array,
  xAI 400 string `error`, Mistral 401 `detail`, OpenRouter 402), Anthropic's
  400 credit-balance message, Gemini's 429 quota message (must be `rate`),
  OpenAI's strict-schema 400 (must be `rejected`), 404, 408, 503, 529, 500.
- `getSettings` migration: `claude-haiku-4-5` → anthropic/fast,
  `claude-opus-5` → anthropic/thorough, `model` absent from the result; a
  stored `provider` is never overwritten by migration; dev seed with an
  OpenAI-shaped key sets provider openai; dev seed never applies on Custom.
  (The seed is a build-time define; the test stubs `globalThis.__MISE_DEV_KEY__`.)
- `errors.test.ts`: every kind's copy names the vendor; Custom variants for
  404 and `{switch}`; NO API KEY no longer says Anthropic.
- Prep (happy-dom): pasting `sk-proj-…` selects OpenAI and the hint names
  `api.openai.com`; with the menu on Custom, pasting `sk-…` leaves it on
  Custom; switching to Custom reveals Base URL and Model ID and hides Model;
  Save refuses an incomplete Custom and writes nothing; Save strips
  `/chat/completions`; an invalid URL typed under Custom does not block Save
  after switching back to a preset.
- Existing extract tests keep passing against the new module.

**Live (`npm run test:live`, opt-in, billed):** `liveKey()` becomes
`liveKey(envVar = "ANTHROPIC_API_KEY")`, same precedence (environment, then
`.env.local`, then `.env`); the bare-key-file fallback stays Anthropic-only.
A new `tests/live/providers.live.ts` runs, for each preset whose key is
present (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
`XAI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`), on the Fast tier:
one extraction from article text, one `found: false` page, one extraction
with three frames. A preset without a key is skipped. The existing
`extract.live.ts` and `vision.live.ts` move to the new API unchanged in what
they assert.

**Only Anthropic can be verified live today.** The other presets, and http
Custom endpoints on localhost or the LAN, are proven against their
documented request and error shapes, not against the vendors. That is stated
in `CLAUDE.md`, and each preset stays marked unverified until its live test
has passed once.

**In the browser:** `npm run build:ext`, `npm run smoke:ext`, then Prep loaded
in real Chromium at 400px, screenshotted and looked at in three states:
default, after pasting an OpenAI-shaped dummy key, and Custom. The action row
still fits (last button's right edge against the row's content box).
`npm run audit:ext` reports no new entries. `npm run build:embed` into a
scratch folder and `tests/build-embed.test.ts` still pass.
`render:portfolio` into a scratch folder renders the error image with
"OVERLOADED".

## Docs

Update `CLAUDE.md` in the same change:

- "Constraints" ("BYOK: user's Anthropic key") and the extension intro
  ("the popup calls the Anthropic API directly").
- Replace "Deferred to launch — multi-provider keys" with a "Providers"
  section: the two paths, the presets table, detection, Custom and keyless
  local servers, the retry asymmetry, which presets have passed a live test.
- The **Model** line (now Fast/Thorough per provider).
- "Failure states" (kinds, vendor-named copy, the OVERLOADED rename).
- The `test:live` paragraph (one env var per vendor).

Regenerating the portfolio's own images (`render:portfolio --out` the
portfolio) is left for the next portfolio update; the portfolio repo has
uncommitted work of Ben's in it.

## Risks

- **Chat Completions is the shape two vendors are moving off.** xAI calls it
  legacy with no end date; OpenAI recommends Responses for new projects. It
  is still the one interface every vendor speaks. Revisit if a sunset date is
  announced.
- **Model IDs drift.** They live in one table, and a live test per vendor
  turns a dead ID into a failing test.
- **Gemini's key format is in flux.** Newer keys may not start with `AIza`.
  The menu covers a missed detection.
- **Unverified presets.** See Testing. A broken preset fails loudly with a
  vendor-named error rather than silently.
- **http Custom from an extension page** may meet private-network rules on
  some LAN addresses. Unverified; localhost is the expected case.
