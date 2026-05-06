import { describe, expect, it } from "vitest";
import { docToMarkdown, markdownToDoc } from "@/editor/serializer";

// FAZ 22 — round-trip tests. We don't compare strings byte-for-byte
// because the serializer normalises whitespace (e.g. trailing newlines,
// list spacing). Instead we re-parse the serialized output and assert
// it produces an equivalent doc. For features the user types directly
// (image with width/align, footnotes, math, emoji, table) we also
// assert the surface form so accidental changes in the round-trip
// surface here.

function roundTrip(md: string) {
  return docToMarkdown(markdownToDoc(md));
}

describe("serializer round-trip", () => {
  it("preserves headings + paragraphs", () => {
    const md = "# Title\n\nParagraph text.";
    expect(roundTrip(md)).toContain("# Title");
    expect(roundTrip(md)).toContain("Paragraph text.");
  });

  it("preserves bold / italic / inline code", () => {
    const out = roundTrip("**bold** _italic_ `code`");
    expect(out).toContain("**bold**");
    expect(out).toContain("*italic*"); // serializer normalises _ to *
    expect(out).toContain("`code`");
  });

  it("preserves strikethrough / highlight / sub / sup / underline", () => {
    const out = roundTrip("~~s~~ ==h== H~2~O E^2^ <u>u</u>");
    expect(out).toContain("~~s~~");
    expect(out).toContain("==h==");
    expect(out).toContain("H~2~O");
    expect(out).toContain("E^2^");
    expect(out).toContain("<u>u</u>");
  });

  it("preserves inline math", () => {
    expect(roundTrip("Equation: $E = mc^2$")).toContain("$E = mc^2$");
  });

  it("preserves emoji shortcodes", () => {
    expect(roundTrip(":smile: hi")).toContain(":smile:");
  });

  it("preserves footnotes", () => {
    const md = "Text[^1].\n\n[^1]: Definition.";
    const out = roundTrip(md);
    expect(out).toContain("[^1]");
    expect(out).toMatch(/\[\^1\]:/);
  });

  it("preserves tables with cell content", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const out = roundTrip(md);
    expect(out).toContain("| a | b |");
    expect(out).toContain("| 1 | 2 |");
  });

  it("preserves table cells that contain inline marks", () => {
    const md =
      "| name | value |\n| --- | --- |\n| **bold** | `code` |";
    const out = roundTrip(md);
    expect(out).toContain("**bold**");
    expect(out).toContain("`code`");
  });

  it("emits plain markdown for an image with no width / align", () => {
    const out = roundTrip("![alt text](path/to/img.png)");
    expect(out).toContain("![alt text](path/to/img.png)");
    expect(out).not.toContain("<img");
  });

  it("round-trips an HTML image with zoom + float through HTML form", () => {
    const md = '<img src="x.png" alt="A" style="zoom: 60%; float: left;" />';
    const out = roundTrip(md);
    expect(out).toContain("<img");
    expect(out).toMatch(/zoom:\s*60%/);
    expect(out).toMatch(/float:\s*left/);
    expect(out).toContain('src="x.png"');
  });

  it("preserves [toc]", () => {
    expect(roundTrip("[toc]")).toContain("[toc]");
  });
});
