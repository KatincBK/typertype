import { defineConfig, devices } from "@playwright/test";

// FAZ 22 (E2E) — Playwright drives the renderer through the Vite dev
// server with the Tauri-API stubs aliased in. We avoid tauri-driver +
// real Tauri builds for now: editor behaviour, keyboard shortcuts and
// dialog wiring are all renderer-side, and stubbing the Tauri surface
// keeps the suite fast and deterministic.

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "retain-on-failure",
    locale: "tr-TR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "E2E=1 npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
