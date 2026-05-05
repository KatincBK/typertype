import { describe, expect, it } from "vitest";
import { extractHeadings } from "@/lib/headings";

describe("extractHeadings", () => {
  it("extracts ATX headings with the correct level", () => {
    const md = "# One\n## Two\n### Three";
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: "One", offset: 0 },
      { level: 2, text: "Two", offset: 6 },
      { level: 3, text: "Three", offset: 13 },
    ]);
  });

  it("ignores ATX-looking lines inside fenced code blocks", () => {
    const md = "# Real\n```\n# fake\n```\n## After";
    const headings = extractHeadings(md);
    expect(headings.map((h) => h.text)).toEqual(["Real", "After"]);
  });

  it("strips trailing closing hashes", () => {
    const md = "## Title ##";
    expect(extractHeadings(md)[0].text).toBe("Title");
  });

  it("returns the byte offset of the heading's first character", () => {
    const md = "intro paragraph\n\n# Heading";
    const [h] = extractHeadings(md);
    expect(md.slice(h.offset, h.offset + 1)).toBe("#");
  });
});
