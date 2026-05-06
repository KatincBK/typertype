import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
});

test("Ctrl+Shift+L toggles the sidebar", async ({ page }) => {
  const shell = page.locator(".app-shell");
  await expect(shell).toHaveClass(/has-sidebar/);

  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+Shift+L");
  await expect(shell).not.toHaveClass(/has-sidebar/);
  await expect(page.locator(".sidebar")).not.toBeVisible();

  await page.keyboard.press("Control+Shift+L");
  await expect(shell).toHaveClass(/has-sidebar/);
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("outline lists headings and jumps the editor on click", async ({
  page,
}) => {
  // The sample doc ships with several h2s; pick a stable one further
  // down the doc so the click has somewhere to scroll to.
  const outlineItem = page
    .locator(".outline .outline-item", { hasText: "Kısayollar" })
    .first();
  await expect(outlineItem).toBeVisible();

  await outlineItem.click();

  // After the jump, the heading should be in the viewport. Assert it
  // by waiting for it to be visible — Playwright will scroll-check.
  const heading = page.locator(".ProseMirror h2", { hasText: "Kısayollar" });
  await expect(heading).toBeInViewport();
});
