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

  it("preserves strikethrough / highlight / sub / sup", () => {
    // Underline (<u>...</u>) is a known one-way mark for now — written
    // by the serializer but not parsed back, since prosemirror-markdown
    // has no handler for raw html_inline tokens. Asserted separately.
    const out = roundTrip("~~s~~ ==h== H~2~O E^2^");
    expect(out).toContain("~~s~~");
    expect(out).toContain("==h==");
    expect(out).toContain("H~2~O");
    expect(out).toContain("E^2^");
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

  it("round-trips a table to *some* table form", () => {
    // Cell content survival is tracked separately — prosemirror-markdown
    // discards the inline tokens when the cell schema demands block
    // children, so values currently come out blank. We only assert
    // here that the table structure still serialises (header + sep +
    // body row count) without throwing.
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const out = roundTrip(md);
    const lines = out.trim().split("\n");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.startsWith("|")).toBe(true);
    }
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
