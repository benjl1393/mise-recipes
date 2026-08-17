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
 * Precedence: ANTHROPIC_API_KEY in the environment, then .env.local, then
 * .env, searched from the extension dir upward to the repo root.
 */
export function liveKey(): string | null {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  const candidates = [
    resolve(here, "../../.env.local"),
    resolve(here, "../../.env"),
    resolve(here, "../../../.env.local"),
    resolve(here, "../../../.env"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const match = /^\s*ANTHROPIC_API_KEY\s*=\s*(.+)$/m.exec(readFileSync(path, "utf8"));
    if (!match?.[1]) continue;
    // Tolerate quoted values and trailing comments.
    const value = match[1].trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  return null;
}

/** Model under test. Haiku by default — same default the extension ships. */
export const LIVE_MODEL = process.env.MISE_LIVE_MODEL ?? "claude-haiku-4-5";
