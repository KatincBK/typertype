import { expect, test } from "@playwright/test";

// Spell-check pulls a 540 KB English dictionary on first activation.
// Allow generous timeouts so the test doesn't flake on slow CI disk
// reads. The dictionary is fetched via Vite asset URL (?url) — no
// network hop, but the parser inside nspell still takes a beat.

// Shared setup for both flows: enable English, type misspellings, wait
// for the .spell-error decoration to land. Returns the locator for the
// "helo" span so each test can act on it.
async function enableEnglishAndFlagHelo(page: import("@playwright/test").Page) {
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

  const errorSpan = page.locator(".ProseMirror .spell-error", {
    hasText: "helo",
  });
  await expect(errorSpan).toBeVisible({ timeout: 15_000 });
  return errorSpan;
}

test("English dictionary flags misspelled words", async ({ page }) => {
  test.setTimeout(45_000);
  await enableEnglishAndFlagHelo(page);
});

test("right-click on a misspelled word opens suggestions", async ({ page }) => {
  test.setTimeout(45_000);
  const helo = await enableEnglishAndFlagHelo(page);

  // The spell plugin's contextmenu handler swallows the OS menu and
  // bubbles a custom event App turns into the React SpellMenu.
  await helo.click({ button: "right" });

  const menu = page.locator(".spell-menu");
  await expect(menu).toBeVisible();
  // The header repeats the misspelled word for context; suggestions
  // sit below.
  await expect(menu.locator(".spell-menu-header")).toHaveText("helo");
});

test("clicking a suggestion replaces the misspelled word", async ({ page }) => {
  test.setTimeout(45_000);
  const helo = await enableEnglishAndFlagHelo(page);

  await helo.click({ button: "right" });
  const menu = page.locator(".spell-menu");
  await expect(menu).toBeVisible();

  // nspell's first suggestion for "helo" is "hello" — assert the menu
  // exposes it and the click writes it back into the doc.
  const helloItem = menu.locator(".spell-menu-item", { hasText: "hello" }).first();
  await expect(helloItem).toBeVisible();
  await helloItem.click();

  // After the replace, the .spell-error decoration on "helo" is gone
  // and the trailing paragraph contains "hello" instead.
  await expect(menu).not.toBeVisible();
  await expect(
    page.locator(".ProseMirror p", { hasText: "hello" }).last(),
  ).toBeVisible();
});
