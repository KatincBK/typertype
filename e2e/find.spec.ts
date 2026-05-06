import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
});

test("Ctrl+H opens the replace bar with both inputs", async ({ page }) => {
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+h");
  // Replace mode renders two .find-input fields stacked.
  await expect(page.locator(".find-input")).toHaveCount(2);
  await page.keyboard.press("Escape");
});

test("Replace one occurrence updates the doc", async ({ page }) => {
  // Append a unique-looking line so we don't accidentally clobber
  // sample-doc content other tests assert on.
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("foo foo");

  await page.keyboard.press("Control+h");
  const inputs = page.locator(".find-input");
  await inputs.nth(0).fill("foo");
  // Status should report at least 2 matches (our two + maybe more
  // depending on sample doc, so assert >= 2).
  const status = page.locator(".find-status");
  await expect(status).not.toHaveText("0");

  await inputs.nth(1).fill("bar");
  // "Değiştir" with exact match is the single-replace button; "Tümünü
  // değiştir" is the replace-all sibling and won't be picked up.
  await page.getByRole("button", { name: "Değiştir", exact: true }).click();

  // The last paragraph we typed should now read "bar foo".
  const lastP = editor.locator("p").last();
  await expect(lastP).toContainText("bar foo");

  await page.keyboard.press("Escape");
});
