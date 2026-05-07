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

  // After load, savedMd matches the seed. Emitting the same content
  // back simulates a notify event triggered by our own save — the
  // listener should yawn and leave the doc untouched.
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

  // Nothing observable to wait *for*, so settle for a tick and assert
  // the heading still reads "hello" — i.e. the editor wasn't rewritten.
  await page.waitForTimeout(150);
  await expect(editor.locator("h1")).toContainText("hello");
});
