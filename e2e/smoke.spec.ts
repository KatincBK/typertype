import { expect, test } from "@playwright/test";

// FAZ 22 (E2E) — smoke pass over the renderer. We assert behaviours
// that depend on multiple subsystems lining up correctly:
// the editor mounts, plugins are wired in the right order, keymap
// commands dispatch, dialog state lands in the DOM. Anything that
// requires the Tauri runtime (file I/O, watcher events, image asset
// resolution) is out of scope for this layer and covered by the unit
// suite + manual smoke tests.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // The Editor mounts after Vite finishes the initial transform and
  // App.tsx flips overrides from null. Wait on a sentinel inside the
  // sample doc so the test doesn't race the live-format / live-math
  // plugin chain.
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
});

test("editor mounts with the sample document", async ({ page }) => {
  await expect(page.locator(".ProseMirror h1").first()).toContainText(
    "Tylike",
  );
  // Header file label should default to "Adsız" (Turkish locale ships
  // by default; en is opt-in via Settings).
  await expect(page.locator(".app-file")).toContainText("Adsız");
});

test("typing a heading prefix converts to a heading on Enter", async ({
  page,
}) => {
  // Park the cursor at the end of the doc, drop a new line, type the
  // heading marker. blockEnter (parity adım 3) finalises on Enter.
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("## Yeni Bölüm");
  await page.keyboard.press("Enter");
  await expect(page.locator(".ProseMirror h2", { hasText: "Yeni Bölüm" }))
    .toBeVisible();
});

test("Ctrl+B wraps the selection in strong", async ({ page }) => {
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("foo");
  await page.keyboard.press("Shift+Home");
  await page.keyboard.press("Control+b");
  // ProseMirror renders the strong mark as <strong>; assert the most
  // recently added paragraph contains one.
  await expect(
    page.locator(".ProseMirror p strong", { hasText: "foo" }).last(),
  ).toBeVisible();
});

test("Ctrl+F opens the find bar and focuses the input", async ({ page }) => {
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+f");
  const input = page.locator(".find-input").first();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  // Typing a query that exists in the sample doc should produce a hit.
  await input.fill("Tylike");
  await expect(page.locator(".find-status")).not.toContainText("0");
  await page.keyboard.press("Escape");
  await expect(input).not.toBeVisible();
});

test("Ctrl+, opens the settings dialog", async ({ page }) => {
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+,");
  await expect(page.locator(".settings-dialog")).toBeVisible();
  await expect(page.locator("#settings-title")).toHaveText("Ayarlar");
  await page.keyboard.press("Escape");
  await expect(page.locator(".settings-dialog")).not.toBeVisible();
});

test("language picker switches the UI to English", async ({ page }) => {
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+,");
  await expect(page.locator(".settings-dialog")).toBeVisible();
  // The Appearance tab is the default; the language picker is the
  // first <select> on that tab.
  const langSelect = page.locator(".settings-body select").first();
  await langSelect.selectOption("en");
  // Title flips immediately via i18next reactivity.
  await expect(page.locator("#settings-title")).toHaveText("Settings");
  // Restore so other tests inherit the default locale.
  await langSelect.selectOption("tr");
});
