import { describe, expect, it } from "vitest";
import { resolveImageSrc } from "@/editor/imageView";

// convertFileSrc is mocked in test/setup.ts as `tauri://localhost/<path>`,
// which lets us assert on a stable transformation for the file-path
// branches without touching the real Tauri API.

describe("resolveImageSrc", () => {
  it("passes through http(s) URLs unchanged", () => {
    expect(resolveImageSrc("https://example.com/x.png", null)).toBe(
      "https://example.com/x.png",
    );
    expect(resolveImageSrc("http://example.com/x.png", "/doc.md")).toBe(
      "http://example.com/x.png",
    );
  });

  it("passes through data URIs unchanged", () => {
    const data = "data:image/png;base64,iVBORw0KGgo=";
    expect(resolveImageSrc(data, null)).toBe(data);
  });

  it("passes through tauri:// URLs unchanged", () => {
    const t = "tauri://localhost/already-resolved.png";
    expect(resolveImageSrc(t, "/doc.md")).toBe(t);
  });

  it("converts absolute file paths via convertFileSrc", () => {
    expect(resolveImageSrc("/abs/path/x.png", null)).toBe(
      "tauri://localhost//abs/path/x.png",
    );
  });

  it("resolves relative paths against the doc's directory", () => {
    expect(resolveImageSrc("img/x.png", "/notes/today.md")).toBe(
      "tauri://localhost//notes/img/x.png",
    );
  });

  it("returns the raw src when there's no doc anchor for a relative path", () => {
    expect(resolveImageSrc("img/x.png", null)).toBe("img/x.png");
  });

  it("returns empty string unchanged", () => {
    expect(resolveImageSrc("", "/doc.md")).toBe("");
  });
});
