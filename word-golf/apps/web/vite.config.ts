import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Monorepo .env lives at word-golf/.env, not apps/web/.env.
  envDir: path.resolve(__dirname, "../.."),
  server: {
    // Allow importing the bundled word lists from the monorepo `data/` dir
    // (two levels up from apps/web).
    fs: { allow: ["../.."] },
  },
});
