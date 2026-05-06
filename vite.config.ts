import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const e2e = process.env.E2E === "1";

// FAZ 22 (E2E) — when E2E=1 we serve the renderer for Playwright in a
// plain browser. Tauri's runtime isn't available, so we alias the two
// modules our app touches (core for `invoke` + `convertFileSrc`,
// event for `listen`) to no-op stubs in e2e/.
const tauriAliases = e2e
  ? {
      "@tauri-apps/api/core": fileURLToPath(
        new URL("./e2e/tauri-stub.ts", import.meta.url),
      ),
      "@tauri-apps/api/event": fileURLToPath(
        new URL("./e2e/tauri-event-stub.ts", import.meta.url),
      ),
    }
  : {};

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      ...tauriAliases,
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
