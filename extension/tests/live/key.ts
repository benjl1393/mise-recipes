import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The key for live tests, from the environment or a gitignored env file.
 *
 * Nothing in this repo ever *writes* the key — `.env*` is gitignored and
 * creating it is the user's job. This only reads it, and only when live tests
 * are explicitly invoked.
 *
 * Precedence: the named variable in the environment, then .env.local, then
 * .env, searched from the extension dir upward to the repo root. One variable
 * per vendor (ANTHROPIC_API_KEY, OPENAI_API_KEY, …); a vendor whose variable is
 * absent is skipped by the live tests, not failed.
 */
export function liveKey(envVar = "ANTHROPIC_API_KEY"): string | null {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) return fromEnv;

  const candidates = [
    resolve(here, "../../.env.local"),
    resolve(here, "../../.env"),
    resolve(here, "../../../.env.local"),
    resolve(here, "../../../.env"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const contents = readFileSync(path, "utf8");

    const assigned = new RegExp(`^\\s*${envVar}\\s*=\\s*(.+)$`, "m").exec(contents);
    if (assigned?.[1]) {
      // Tolerate quoted values and trailing comments.
      const value = assigned[1].trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
      if (value) return value;
    }

    // Also accept a file that is just the key. Writing the bare secret is the
    // obvious thing to do when told "put your key in this file", and failing
    // with "no key found" while staring at a file containing the key is a
    // needlessly bad experience. Only for Anthropic: a bare key from another
    // vendor carries no prefix this could recognise reliably.
    if (envVar !== "ANTHROPIC_API_KEY") continue;
    const bare = /^\s*(sk-ant-[A-Za-z0-9_-]+)\s*$/m.exec(contents);
    if (bare?.[1]) return bare[1];
  }
  return null;
}

/** Model under test. Haiku by default — same default the extension ships. */
export const LIVE_MODEL = process.env.MISE_LIVE_MODEL ?? "claude-haiku-4-5";
