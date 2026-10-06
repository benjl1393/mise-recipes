import { defineConfig } from "vitest/config";

/**
 * Live-API tests. Deliberately a separate config with a separate filename
 * pattern (`*.live.ts`, not `*.test.ts`) so `npm run test:ext` can never pick
 * them up by accident — they cost money and need a real key.
 *
 *   npm run test:live
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/live/**/*.live.ts"],
    // A real round trip to Anthropic is far slower than the 5s default.
    testTimeout: 120_000,
    // Serial: these are billed calls, not something to fan out.
    fileParallelism: false,
  },
});
