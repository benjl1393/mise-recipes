import { getSettings, setSettings } from "../../lib/storage";
import type { Units } from "../../lib/types";

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
          <option value="claude-haiku-4-5">Haiku 4.5 — fast, cheapest per extraction</option>
          <option value="claude-opus-5">Opus 5 — slower, best on messy sources</option>
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
          Needs permission to read the pages you visit. Detection runs on this
          device and no page leaves it.
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

  // Not a setting — a live browser permission, so it reads from and writes to
  // chrome.permissions rather than storage, and never goes through save().
  const ALL_URLS = { origins: ["<all_urls>"] };
  void chrome.permissions.contains(ALL_URLS).then((granted) => {
    watchPages.checked = granted;
  });

  const say = (text: string, hold = 4000) => {
    status.textContent = text;
    setTimeout(() => (status.textContent = ""), hold);
  };

  watchPages.addEventListener("change", () => {
    const wanted = watchPages.checked;
    // request() only counts inside the click's user gesture, which an await
    // before it would spend. Call it first, resolve the UI afterwards.
    const settled = wanted
      ? chrome.permissions.request(ALL_URLS)
      : chrome.permissions.remove(ALL_URLS).then((removed) => !removed);

    void settled
      .then((granted) => {
        watchPages.checked = granted;
        if (!granted) return say(wanted ? "Chrome declined that." : "No longer watching.");
        // Registered content scripts only attach on the next navigation, so
        // whatever is already open stays dark until it is reloaded. Saying so
        // here is cheaper than the user concluding the feature is broken.
        say("Watching. Reload any open tabs to arm them.", 6000);
      })
      .catch((error: unknown) => {
        // A rejected request() used to disappear entirely — no prompt, no
        // error, and a checkbox still sitting there looking switched on.
        // Whatever Chrome objects to, the user should be able to see it.
        watchPages.checked = !wanted;
        say(`Couldn't: ${(error as Error)?.message ?? String(error)}`, 8000);
      });
  });

  void (async () => {
    const settings = await getSettings();
    apiKey.value = settings.apiKey;
    model.value = settings.model;
    captureFrames.checked = settings.captureFrames;
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
      model: model.value,
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
