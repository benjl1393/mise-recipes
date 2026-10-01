import { getSettings, setSettings } from "../../lib/storage";
import type { Units } from "../../lib/types";
import type { Tier } from "../../lib/providers/presets";

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
    <form id="prep-form">
      <label class="field">
        <span class="label">Anthropic API key</span>
        <input id="apiKey" type="password" autocomplete="off" spellcheck="false"
               placeholder="sk-ant-…" />
        <span class="hint">
          Stored on this device only. Sent to api.anthropic.com and nowhere else.
          No key yet?
          <a href="https://console.anthropic.com/settings/keys"
             target="_blank" rel="noreferrer noopener">Make one here</a>
          — you pay Anthropic directly, usually well under a cent per recipe.
        </span>
      </label>

      <fieldset class="field">
        <legend class="label">Units</legend>
        <div class="radios">
          <label><input type="radio" name="units" value="metric" /> Metric</label>
          <label><input type="radio" name="units" value="imperial" /> Imperial</label>
        </div>
        <span class="hint">Claude converts by ingredient density, not naive math.</span>
      </fieldset>

      <label class="field">
        <span class="label">Model</span>
        <select id="model">
          <option value="fast">Fast — cheapest per recipe</option>
          <option value="thorough">Thorough — slower, best on messy sources</option>
        </select>
      </label>

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

  const form = root.querySelector("#prep-form") as HTMLFormElement;
  const apiKey = root.querySelector("#apiKey") as HTMLInputElement;
  const model = root.querySelector("#model") as HTMLSelectElement;
  const captureFrames = root.querySelector("#captureFrames") as HTMLInputElement;
  const watchPages = root.querySelector("#watchPages") as HTMLInputElement;
  const status = root.querySelector("#prep-status") as HTMLElement;

  const say = (text: string, hold = 4000) => {
    status.textContent = text;
    setTimeout(() => (status.textContent = ""), hold);
  };

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

  void (async () => {
    const settings = await getSettings();
    apiKey.value = settings.apiKey;
    model.value = settings.tier;
    captureFrames.checked = settings.captureFrames;
    watchPages.checked = settings.pulseOnDetect;
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="units"][value="${settings.units}"]`,
    );
    if (radio) radio.checked = true;
  })();

  // Submitting is wired for Enter-in-a-field; the SAVE button lives in the
  // shared action row, so it dispatches submit rather than duplicating this.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });

  async function save() {
    const units = (new FormData(form).get("units") as Units | null) ?? "metric";
    await setSettings({
      apiKey: apiKey.value.trim(),
      units,
      tier: model.value as Tier,
      captureFrames: captureFrames.checked,
    });
    status.textContent = "Prepped.";
    setTimeout(() => (status.textContent = ""), 2000);
  }
}

/** Trigger a save from outside the view (the shared action row's SAVE). */
export function submitPrep(root: HTMLElement): void {
  (root.querySelector("#prep-form") as HTMLFormElement | null)?.requestSubmit();
}
