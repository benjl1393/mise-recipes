import { getSettings, setSettings } from "../lib/storage";
import type { Units } from "../lib/types";

const form = document.getElementById("form") as HTMLFormElement;
const apiKey = document.getElementById("apiKey") as HTMLInputElement;
const model = document.getElementById("model") as HTMLSelectElement;
const captureFrames = document.getElementById("captureFrames") as HTMLInputElement;
const status = document.getElementById("status") as HTMLElement;

async function load() {
  const settings = await getSettings();
  apiKey.value = settings.apiKey;
  model.value = settings.model;
  captureFrames.checked = settings.captureFrames;
  const radio = form.querySelector<HTMLInputElement>(
    `input[name="units"][value="${settings.units}"]`,
  );
  if (radio) radio.checked = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const units = (new FormData(form).get("units") as Units | null) ?? "metric";
  await setSettings({
    apiKey: apiKey.value.trim(),
    units,
    model: model.value,
    captureFrames: captureFrames.checked,
  });
  status.textContent = "Prepped.";
  setTimeout(() => (status.textContent = ""), 2000);
});

void load();
