import { expect, test } from "@playwright/test";

// Spell-check pulls a 540 KB English dictionary on first activation.
// Allow generous timeouts so the test doesn't flake on slow CI disk
// reads. The dictionary is fetched via Vite asset URL (?url) — no
// network hop, but the parser inside nspell still takes a beat.

test("English dictionary flags misspelled words", async ({ page }) => {
  test.setTimeout(45_000);

  await page.goto("/");
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();

  // Open Settings → Spelling tab → set language = English.
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+,");
  await expect(page.locator(".settings-dialog")).toBeVisible();

  await page.locator(".settings-tab", { hasText: "Yazım" }).click();
  await page.locator(".settings-body select").selectOption("en");
  await page.keyboard.press("Escape");
  await expect(page.locator(".settings-dialog")).not.toBeVisible();

  // Type a clear misspelling at the end of the doc.
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("teh helo wrld");

  // The plugin debounces a rescan ~300 ms after typing stops; combined
  // with the dictionary load we may need to wait a moment for the
  // decorations to appear.
  const errorSpan = page.locator(".ProseMirror .spell-error", {
    hasText: "helo",
  });
  await expect(errorSpan).toBeVisible({ timeout: 15_000 });
});
