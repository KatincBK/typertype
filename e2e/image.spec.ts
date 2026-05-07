import { expect, test } from "@playwright/test";

// Image NodeView: typing the markdown form is the cheapest way to
// drop one into the doc without going through pick_image_dialog +
// copy_image_to_assets (those would need real-file mocks). The image
// itself never loads — the URL is fake — but ImageView still mounts,
// reacts to selection, and renders the popover. That's enough to
// cover the renderer-side behaviour.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
});

test("typed image markdown mounts an ImageView wrapper", async ({ page }) => {
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("![alt text](https://example.invalid/img.png)");

  // The wrapper is the contenteditable host for ImageView. We don't
  // assert on the <img> — its src will 404 — only that the NodeView
  // injected its scaffolding.
  await expect(editor.locator(".image-wrapper").last()).toBeVisible();
});

test("clicking the image opens the popover and aligns left", async ({
  page,
}) => {
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("![](https://example.invalid/x.png)");

  const wrapper = editor.locator(".image-wrapper").last();
  // Force the click — the broken <img> may be 0×0 because its src
  // 404s, so Playwright's actionability checks would otherwise stall.
  await wrapper.click({ force: true });

  // ProseMirror sets ProseMirror-selectednode on the wrapper when the
  // NodeSelection lands; ImageView mirrors that into a `.selected`
  // class for our own styles.
  await expect(wrapper).toHaveClass(/selected/);

  // Hover/selected state un-hides the popover; the align-left button
  // is the first one in the popover with title set via i18n.
  const alignLeft = wrapper.locator(".image-popover .image-btn", {
    hasText: "⯇",
  });
  await alignLeft.click({ force: true });

  await expect(wrapper).toHaveClass(/align-left/);
});

test("dragging the resize handle writes a width attr", async ({ page }) => {
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("![](https://example.invalid/resize.png)");

  const wrapper = editor.locator(".image-wrapper").last();
  await wrapper.click({ force: true });
  await expect(wrapper).toHaveClass(/selected/);

  // The handle is a contenteditable=false sibling of the <img>. Its
  // controls layer becomes opaque only when the wrapper is selected
  // or hovered, but the element itself has fixed 10x10 dimensions
  // either way, so boundingBox() returns a real rect.
  const handle = wrapper.locator(".image-resize-handle");
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // ImageView listens for mousedown on the handle, then watches
  // window mousemove/mouseup, so we drive real mouse events rather
  // than dispatching synthetic ones. Even with a 404'd <img>
  // (naturalWidth=0), the percentage math produces a non-zero
  // string ⇒ has-width lands and the width label shows the value.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 50, startY, { steps: 5 });
  await page.mouse.up();

  await expect(wrapper).toHaveClass(/has-width/);
  const label = wrapper.locator(".image-width-label");
  await expect(label).toHaveText(/\d+%$/);
});
