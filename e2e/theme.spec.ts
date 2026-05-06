import { expect, test } from "@playwright/test";

// Theme switching writes data-theme on <html>; the editor.css cascade
// reads from there. We assert the round-trip from the header <select>
// without dragging the OS into the picture (auto mode is harder to
// pin down deterministically because it follows the system pref).

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
});

test("theme select flips data-theme on the document element", async ({
  page,
}) => {
  const html = page.locator("html");
  const select = page.locator(".app-theme-select");

  await select.selectOption("dark");
  await expect(html).toHaveAttribute("data-theme", "dark");

  await select.selectOption("sepia");
  await expect(html).toHaveAttribute("data-theme", "sepia");

  await select.selectOption("light");
  await expect(html).toHaveAttribute("data-theme", "light");
});
