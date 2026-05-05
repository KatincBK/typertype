import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// FAZ 22 — Vitest configuration. Separate from vite.config.ts so the
// Tauri dev-server settings (fixed port, src-tauri watch ignore) don't
// leak into the test runner. Uses jsdom for DOM-touching tests; Tauri
// invoke is mocked in test/setup.ts.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    css: false,
  },
});
