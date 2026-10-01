// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { installChromeMock } from "./helpers/chrome-mock";
import { mountPrep } from "../src/popup/views/prep";

const tick = () => new Promise((r) => setTimeout(r, 0));

let local: Record<string, unknown>;
let root: HTMLElement;

async function mount(seed: Record<string, unknown> = {}) {
  local = installChromeMock(seed) as Record<string, unknown>;
  root = document.createElement("div");
  document.body.replaceChildren(root);
  mountPrep(root);
  await tick();
  await tick();
}

const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;

const type = (sel: string, value: string) => {
  const el = $<HTMLInputElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const choose = (value: string) => {
  const el = $<HTMLSelectElement>("#provider");
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
};

const save = async () => {
  $<HTMLFormElement>("#prep-form").dispatchEvent(new Event("submit", { cancelable: true }));
  await tick();
  await tick();
};

const stored = () => local["mise:settings"] as Record<string, unknown> | undefined;

beforeEach(() => vi.unstubAllGlobals());

describe("Prep", () => {
  it("offers every provider and starts on the empty-key hint with a key link", async () => {
    await mount();
    const options = [...root.querySelectorAll("#provider option")].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toEqual([
      "anthropic",
      "openai",
      "gemini",
      "xai",
      "mistral",
      "openrouter",
      "custom",
    ]);
    expect($("#key-hint").textContent).toMatch(/Works with Anthropic, OpenAI/);
    expect($<HTMLAnchorElement>("#key-hint a").href).toBe(
      "https://console.anthropic.com/settings/keys",
    );
  });

  it("sets the provider from a pasted key and names where it goes", async () => {
    await mount();
    type("#apiKey", "sk-proj-abc");
    expect($<HTMLSelectElement>("#provider").value).toBe("openai");
    expect($("#key-hint").textContent).toContain("api.openai.com");
  });

  it("never moves the menu off Custom (DeepSeek and others issue sk- keys)", async () => {
    await mount();
    choose("custom");
    type("#apiKey", "sk-deepseek-abc");
    expect($<HTMLSelectElement>("#provider").value).toBe("custom");
  });

  it("asks for a pick when the key has no known prefix, until one is picked", async () => {
    await mount();
    type("#apiKey", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6");
    expect($("#key-hint").textContent).toMatch(/Couldn't tell/);
    choose("mistral");
    expect($("#key-hint").textContent).toContain("api.mistral.ai");
  });

  it("shows Base URL and Model ID only on Custom, and hides the tier menu there", async () => {
    await mount();
    expect($("#baseURL-field").hidden).toBe(true);
    expect($("#tier-field").hidden).toBe(false);
    choose("custom");
    expect($("#baseURL-field").hidden).toBe(false);
    expect($("#customModel-field").hidden).toBe(false);
    expect($("#tier-field").hidden).toBe(true);
  });

  it("refuses an incomplete Custom and writes nothing", async () => {
    await mount();
    choose("custom");
    type("#baseURL", "localhost:11434");
    await save();
    expect(stored()).toBeUndefined();
    expect($("#prep-status").textContent).toMatch(/base URL and a model ID/);
  });

  it("saves Custom with the URL normalised, keyless", async () => {
    await mount();
    choose("custom");
    type("#baseURL", "http://localhost:11434/v1/chat/completions");
    type("#customModel", "llama3.3");
    await save();
    expect(stored()).toMatchObject({
      apiKey: "",
      provider: "custom",
      baseURL: "http://localhost:11434/v1",
      customModel: "llama3.3",
    });
    expect(stored()).not.toHaveProperty("model");
  });

  it("does not let a bad URL left under Custom block saving another provider", async () => {
    await mount();
    choose("custom");
    type("#baseURL", "not a url");
    choose("openai");
    type("#apiKey", "sk-proj-abc");
    await save();
    expect(stored()).toMatchObject({ provider: "openai", apiKey: "sk-proj-abc", tier: "fast" });
  });

  it("loads stored settings, including a migrated model", async () => {
    await mount({ "mise:settings": { apiKey: "sk-ant-x", model: "claude-opus-5" } });
    expect($<HTMLSelectElement>("#provider").value).toBe("anthropic");
    expect($<HTMLSelectElement>("#tier").value).toBe("thorough");
    expect($("#key-hint").textContent).toContain("api.anthropic.com");
  });
});
