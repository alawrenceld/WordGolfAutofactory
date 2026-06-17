import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow importing the bundled word lists from the monorepo `data/` dir
    // (two levels up from apps/web).
    fs: { allow: ["../.."] },
  },
});
