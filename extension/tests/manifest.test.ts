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
    expect(manifest.optional_host_permissions).toEqual(["<all_urls>"]);
    expect(manifest.host_permissions).toEqual(["https://api.anthropic.com/*"]);
  });

  it("ships the full icon ladder", () => {
    expect(Object.keys(manifest.icons).sort()).toEqual(["128", "16", "32", "48"]);
  });
});
