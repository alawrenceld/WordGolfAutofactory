/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow importing the bundled word lists from the monorepo `data/` dir
    // (two levels up from apps/web).
    fs: { allow: ["../.."] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Transform the workspace TS packages instead of treating them as externals.
    server: { deps: { inline: ["@word-golf/engine", "@word-golf/ld"] } },
  },
});
