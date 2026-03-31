import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "youtube-transcript": path.resolve(
        __dirname,
        "node_modules/youtube-transcript/dist/youtube-transcript.esm.js"
      ),
    },
  },
});
