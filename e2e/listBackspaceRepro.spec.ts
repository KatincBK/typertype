import { expect, test } from "@playwright/test";

// REGRESSION — "öncül sorunu": Backspace at the END of a list item's line
// jumped the caret to the start of the NEXT item instead of just deleting the
// last character. Mid-text Backspace behaved correctly.
//
// Root cause (found headlessly, NOT a native/widget quirk as first assumed):
// `backspaceEmptyPair` gated on `PAIRS[before] === after`. At a textblock end
// `after` is undefined and, for a plain char, `PAIRS[before]` is too, so
// `undefined === undefined` fired a destructive delete($from.pos-1, $from.pos+1)
// that crossed the block boundary. Covered by the unit test in
// test/editor/listBackspace.test.ts ("backspaceEmptyPair"); this spec is the
// integration-level guard (runs on a Windows host / CI — WSL lacks chromium deps).
//
// The repro builds an ordered list with two items, parks the caret at the end
// of item 1 ("abcde"), presses Backspace, then types a sentinel "X" so we can
// SEE where the caret landed by reading the resulting list items.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
});

async function dumpList(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const ol = document.querySelector(".ProseMirror ol");
    if (!ol) return { found: false, items: [] as string[] };
    const items = Array.from(ol.querySelectorAll(":scope > li")).map(
      (li) => (li.textContent ?? "").replace(/⠀/g, "").trim(), // strip ⠿ handle
    );
    return { found: true, items };
  });
}

test("Backspace at end of ordered list item deletes a char, caret stays put", async ({
  page,
}) => {
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");

  // Create an ordered list: "1. abcde" + Enter spawns item2, then "fghij".
  await page.keyboard.type("1. abcde");
  await page.keyboard.press("Enter");
  await page.keyboard.type("fghij");

  let state = await dumpList(page);
  console.log("AFTER BUILD:", JSON.stringify(state));
  expect(state.found).toBe(true);

  // Move caret to the END of item 1 ("abcde"): up one line, then End.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("End");

  // The reported failing action.
  await page.keyboard.press("Backspace");
  const afterBs = await dumpList(page);
  console.log("AFTER BACKSPACE:", JSON.stringify(afterBs));

  // Sentinel: where did the caret go?
  await page.keyboard.type("X");
  const afterX = await dumpList(page);
  console.log("AFTER TYPING X:", JSON.stringify(afterX));

  // CORRECT behaviour: item1 "abcde" -> delete e -> "abcd" -> type X -> "abcdX";
  // item2 still "fghij"; two items intact.
  expect(afterX.items.length).toBe(2);
  expect(afterX.items[0]).toBe("abcdX");
  expect(afterX.items[1]).toBe("fghij");
});
