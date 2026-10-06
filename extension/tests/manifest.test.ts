import { describe, it, expect } from "vitest";
import manifest from "../manifest.json";

describe("manifest", () => {
  it("is MV3 and named Mise", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("Mise");
  });

  it("requests only the install-time permissions the spec allows", () => {
    expect([...manifest.permissions].sort()).toEqual(
      ["activeTab", "contextMenus", "downloads", "scripting", "storage"].sort(),
    );
    // Host access is install-time now. The optional-permission design was
    // dropped 2026-08-20: Dia never prompted and never fired permissions.onAdded,
    // so the pulse was dead there. Not `<all_urls>` either — that spans file://
    // and ftp://, which Mise has no use for.
    expect((manifest as Record<string, unknown>).optional_host_permissions).toBeUndefined();
    expect(manifest.host_permissions).toEqual([
      "https://*/*",
      "http://*/*",
    ]);
  });

  it("declares the detector rather than registering it at runtime", () => {
    // chrome.scripting.registerContentScripts is not reliably implemented in
    // Chromium forks; a declared script is.
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["https://*/*", "http://*/*"],
        js: ["content/detect.js"],
        run_at: "document_idle",
        all_frames: false,
      },
    ]);
  });

  it("ships the full icon ladder", () => {
    expect(Object.keys(manifest.icons).sort()).toEqual(["128", "16", "32", "48"]);
  });
});
