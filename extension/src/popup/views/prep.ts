import { getSettings, setSettings } from "../../lib/storage";
import {
  detectProvider,
  normalizeBaseURL,
  PRESETS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type PresetId,
  type ProviderId,
  type Tier,
} from "../../lib/providers/presets";
import type { Units } from "../../lib/types";

const STORED = "Stored on this device only.";
const VENDORS =
  "Anthropic, OpenAI, Gemini, Grok, Mistral, OpenRouter, or any OpenAI-compatible API";

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function httpHost(url: string): string {
  try {
    const u = new URL(normalizeBaseURL(url));
    return u.protocol === "http:" || u.protocol === "https:" ? u.host : "";
  } catch {
    return "";
  }
}

/**
 * The line under the key field. With no key it says how to get one — that is
 * when someone needs the link; once a key is in, it says where the key goes.
 */
function keyHint(id: ProviderId, key: string, baseURL: string, undetected: boolean): string {
  if (id === "custom") {
    const host = httpHost(baseURL);
    const where = host ? esc(host) : "the base URL below";
    return `${STORED} Sent to ${where} and nowhere else. Leave it empty if your server needs no key.`;
  }
  if (undetected) return "Couldn't tell which provider this key is for. Pick it below.";
  const p = PRESETS[id as PresetId];
  if (!key.trim()) {
    return (
      `${STORED} Works with ${VENDORS}. No key yet? ` +
      `<a href="${p.keyUrl}" target="_blank" rel="noreferrer noopener">Make one at ${p.label}</a>.`
    );
  }
  return `${STORED} Sent to ${p.host} and nowhere else. You pay ${p.label} directly.`;
}

/**
 * Prep, as a pane inside the popup rather than an options page.
 *
 * It used to be a full tab; leaving the popup to change a setting breaks the
 * fire-and-leave gesture the product is built around, so it lives here now
 * and the options page is gone.
 *
 * The markup is authored here rather than in popup.html so the whole view —
 * fields, wiring and status line — is one readable unit.
 */
export function mountPrep(root: HTMLElement): void {
  root.innerHTML = `
    <div class="ticket-top"><span class="brand">MISE · PREP</span></div>
    <form id="prep-form" novalidate>
      <label class="field">
        <span class="label">API key</span>
        <input id="apiKey" type="password" autocomplete="off" spellcheck="false"
               placeholder="Paste your key" />
        <span class="hint" id="key-hint"></span>
      </label>

      <label class="field">
        <span class="label">Provider</span>
        <select id="provider">
          ${PROVIDER_IDS.map((id) => `<option value="${id}">${PROVIDER_LABELS[id]}</option>`).join("")}
        </select>
      </label>

      <label class="field" id="baseURL-field" hidden>
        <span class="label">Base URL</span>
        <input id="baseURL" type="url" autocomplete="off" spellcheck="false"
               placeholder="https://…/v1" />
      </label>

      <label class="field" id="customModel-field" hidden>
        <span class="label">Model ID</span>
        <input id="customModel" type="text" autocomplete="off" spellcheck="false" />
      </label>

      <label class="field" id="tier-field">
        <span class="label">Model</span>
        <select id="tier">
          <option value="fast">Fast — cheapest per recipe</option>
          <option value="thorough">Thorough — slower, best on messy sources</option>
        </select>
      </label>

      <fieldset class="field">
        <legend class="label">Units</legend>
        <div class="radios">
          <label><input type="radio" name="units" value="metric" /> Metric</label>
          <label><input type="radio" name="units" value="imperial" /> Imperial</label>
        </div>
        <span class="hint">Mise converts by ingredient density, not naive math.</span>
      </fieldset>

      <label class="field checkbox">
        <input id="captureFrames" type="checkbox" />
        <span>Scan video frames on Reels, TikTok, and Shorts</span>
      </label>

      <label class="field checkbox explained">
        <input id="watchPages" type="checkbox" />
        <span>Pulse the icon when a page has a recipe</span>
        <span class="hint">
          Only pages that declare a recipe. Detection runs on this device and
          no page ever leaves it.
        </span>
      </label>
    </form>
    <p id="prep-status" class="status" role="status"></p>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const form = $<HTMLFormElement>("#prep-form");
  const apiKey = $<HTMLInputElement>("#apiKey");
  const hint = $<HTMLElement>("#key-hint");
  const provider = $<HTMLSelectElement>("#provider");
  const baseURL = $<HTMLInputElement>("#baseURL");
  const customModel = $<HTMLInputElement>("#customModel");
  const tier = $<HTMLSelectElement>("#tier");
  const captureFrames = $<HTMLInputElement>("#captureFrames");
  const watchPages = $<HTMLInputElement>("#watchPages");
  const status = $<HTMLElement>("#prep-status");

  const say = (text: string, hold = 4000) => {
    status.textContent = text;
    setTimeout(() => (status.textContent = ""), hold);
  };

  /** Set when a pasted key matched no prefix; cleared once a provider is picked. */
  let undetected = false;

  /*
   * Everything derived from the form lives here. Setting select.value from
   * script fires no change event, so the key handler calls this directly
   * rather than relying on one.
   */
  function sync() {
    const id = provider.value as ProviderId;
    const custom = id === "custom";
    $("#baseURL-field").hidden = !custom;
    $("#customModel-field").hidden = !custom;
    $("#tier-field").hidden = custom;
    hint.innerHTML = keyHint(id, apiKey.value, baseURL.value, undetected && !custom);
  }

  apiKey.addEventListener("input", () => {
    const key = apiKey.value.trim();
    const detected = detectProvider(key);
    // Never off Custom: several OpenAI-compatible vendors issue sk- keys.
    if (detected && provider.value !== "custom") provider.value = detected;
    undetected = key !== "" && detected === null;
    sync();
  });
  provider.addEventListener("change", () => {
    undetected = false;
    sync();
  });
  baseURL.addEventListener("input", sync);

  /*
   * This was a permission toggle until 2026-08-20 — it called
   * chrome.permissions.request() for optional host access. Dia never showed a
   * prompt and never fired permissions.onAdded, so the feature was simply dead
   * there with nothing to see. The detector is declared in the manifest now, so
   * this is an ordinary stored setting and works in any Chromium.
   *
   * Written immediately rather than on SAVE: a switch that needs a second,
   * separate confirmation to take effect reads as broken.
   */
  watchPages.addEventListener("change", () => {
    const on = watchPages.checked;
    void setSettings({ pulseOnDetect: on }).then(() => {
      // The content script reads this at document_idle, so a tab that is
      // already open has already made its decision.
      say(on ? "Watching. Reload any open tabs to arm them." : "No longer watching.", 6000);
    });
  });

  sync();
  void (async () => {
    const settings = await getSettings();
    apiKey.value = settings.apiKey;
    provider.value = settings.provider;
    tier.value = settings.tier;
    baseURL.value = settings.baseURL;
    customModel.value = settings.customModel;
    captureFrames.checked = settings.captureFrames;
    watchPages.checked = settings.pulseOnDetect;
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="units"][value="${settings.units}"]`,
    );
    if (radio) radio.checked = true;
    sync();
  })();

  // Submitting is wired for Enter-in-a-field; the SAVE button lives in the
  // shared action row, so it dispatches submit rather than duplicating this.
  // The form is novalidate: a hidden Custom field must never block Save, and
  // the message belongs in the status line, not a native bubble.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });

  async function save() {
    const id = provider.value as ProviderId;
    const base = normalizeBaseURL(baseURL.value);
    const model = customModel.value.trim();
    if (id === "custom" && (!httpHost(base) || !model)) {
      say("Custom needs a base URL and a model ID.");
      return;
    }
    const units = (new FormData(form).get("units") as Units | null) ?? "metric";
    await setSettings({
      apiKey: apiKey.value.trim(),
      provider: id,
      tier: tier.value as Tier,
      // Kept even when another provider is chosen, so switching back loses nothing.
      baseURL: base,
      customModel: model,
      units,
      captureFrames: captureFrames.checked,
    });
    baseURL.value = base;
    status.textContent = "Prepped.";
    setTimeout(() => (status.textContent = ""), 2000);
  }
}

/** Trigger a save from outside the view (the shared action row's SAVE). */
export function submitPrep(root: HTMLElement): void {
  (root.querySelector("#prep-form") as HTMLFormElement | null)?.requestSubmit();
}
