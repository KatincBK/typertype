import { expect, test } from "@playwright/test";

// File watcher: drive the same code path as a real Rust notify event
// by emitting through the event stub's window helper. The Tauri stub
// is configured via window.__tylikeE2E so launchArgs returns a mock
// file path and read_text_file responds with the seed content. Once
// the editor has loaded that file, an external "change" comes in
// through the same channel App.tsx subscribes to.

test("clean external change reloads the editor with new content", async ({
  page,
}) => {
  const PATH = "/mock/notes.md";
  const initial = "# initial heading\n\noriginal body text";
  const updated = "# updated heading\n\nfresh body text";

  await page.addInitScript(
    ({ path, content }) => {
      (
        window as Window & {
          __tylikeE2E?: {
            initialFile?: string | null;
            files?: Record<string, string>;
          };
        }
      ).__tylikeE2E = {
        initialFile: path,
        files: { [path]: content },
      };
    },
    { path: PATH, content: initial },
  );

  await page.goto("/");

  const editor = page.locator(".ProseMirror");
  // initial heading shows up once launchArgs ⇒ read_text_file ⇒
  // loadFile resolves and the editor mounts the markdown.
  await expect(editor.locator("h1")).toContainText("initial heading");

  // Emit a synthetic file-changed event. App.tsx's onFileChanged
  // handler matches `payload.path === filePath`, sees the doc is
  // clean (savedMd === currentMd), and overwrites the editor doc.
  await page.evaluate(
    ({ path, content }) => {
      const e2e = (
        window as Window & {
          __tylikeE2E?: {
            emit?: (event: string, payload?: unknown) => void;
          };
        }
      ).__tylikeE2E;
      e2e?.emit?.("tylike://file-changed", {
        path,
        content,
        error: null,
      });
    },
    { path: PATH, content: updated },
  );

  await expect(editor.locator("h1")).toContainText("updated heading");
});

test("self-write echo (incoming === savedMd) is ignored", async ({ page }) => {
  const PATH = "/mock/echo.md";
  const seed = "# hello\n\nbody";

  await page.addInitScript(
    ({ path, content }) => {
      (
        window as Window & {
          __tylikeE2E?: {
            initialFile?: string | null;
            files?: Record<string, string>;
          };
        }
      ).__tylikeE2E = {
        initialFile: path,
        files: { [path]: content },
      };
    },
    { path: PATH, content: seed },
  );

  await page.goto("/");
  const editor = page.locator(".ProseMirror");
  await expect(editor.locator("h1")).toContainText("hello");

  // Make the doc dirty so the listener has a meaningful no-op signal:
  // when the filter works, NO confirm dialog fires; if the filter ever
  // regressed, App.tsx would route this through window.confirm because
  // currentMd diverges from savedMd. Counting dialogs gives us a hard
  // pass/fail rather than depending on visible content (which would
  // look identical either way for an echo).
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" extra");
  // Belt-and-suspenders: the editor footer should now show some kind
  // of dirty indicator. We don't assert on it (it's optional UX) —
  // the important state is that currentMd !== savedMd internally.

  let dialogCount = 0;
  page.on("dialog", (d) => {
    dialogCount++;
    void d.dismiss();
  });

  await page.evaluate(
    ({ path, content }) => {
      (
        window as Window & {
          __tylikeE2E?: { emit?: (e: string, p?: unknown) => void };
        }
      ).__tylikeE2E?.emit?.("tylike://file-changed", {
        path,
        content,
        error: null,
      });
    },
    { path: PATH, content: seed },
  );

  await page.waitForTimeout(150);

  expect(dialogCount).toBe(0);
  // The user's edit is also still present — proves the listener did
  // not silently overwrite the editor through the clean-state branch.
  await expect(editor).toContainText("body extra");
});
