import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extension = fileURLToPath(new URL("..", import.meta.url));
const build = (out: string) =>
  execFileSync("node", ["scripts/build-embed.mjs", "--out", out], { cwd: extension, stdio: "pipe" });

describe("build:embed", () => {
  it("writes a self-contained embed with provenance and no key", () => {
    const out = join(mkdtempSync(join(tmpdir(), "embed-")), "mise");
    build(out);
    for (const f of ["index.html", "embed.js", "popup/popup.css", "fonts/DepartureMono-Regular.woff2", "fonts/CommitMono-400-Regular.otf", "provenance.json"]) {
      expect(existsSync(join(out, f)), f).toBe(true);
    }
    expect(readFileSync(join(out, "embed.js"), "utf8")).not.toMatch(/sk-ant-/);
    const p = JSON.parse(readFileSync(join(out, "provenance.json"), "utf8"));
    expect(p.source).toBe("recipe-archiver");
    expect(p.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof p.dirty).toBe("boolean");
  }, 30_000);

  it("refuses an --out it would be unsafe to delete", () => {
    expect(() => build(tmpdir())).toThrow();
  });
});
