import { describe, expect, it } from "vitest";
import type { Node } from "prosemirror-model";
import { docToMarkdown, markdownToDoc } from "@/editor/serializer";

// Literal-marker model: markdown markers stay in the document as real text;
// markdownToDoc runs the inline reparser (applyInlineMarks) so a freshly
// loaded file already carries the derived style + `markup` marks. These
// tests exercise that full parse → reparse → serialize pipeline.

// [text, sortedMarkNames] for every text node in document order.
function textRuns(doc: Node): Array<[string, string[]]> {
  const runs: Array<[string, string[]]> = [];
  doc.descendants((node) => {
    if (node.isText && node.text) {
      runs.push([node.text, node.marks.map((m) => m.type.name).sort()]);
    }
  });
  return runs;
}

describe("inline reparser (literal-marker model)", () => {
  it("derives strong + markup from literal ** text", () => {
    const doc = markdownToDoc("**bold**");
    expect(doc.textContent).toBe("**bold**");
    expect(textRuns(doc)).toEqual([
      ["**", ["markup", "strong"]],
      ["bold", ["strong"]],
      ["**", ["markup", "strong"]],
    ]);
  });

  it("derives em from literal * text", () => {
    expect(textRuns(markdownToDoc("*x*"))).toEqual([
      ["*", ["em", "markup"]],
      ["x", ["em"]],
      ["*", ["em", "markup"]],
    ]);
  });

  it("keeps markers verbatim and round-trips every mark type", () => {
    const md = "~~s~~ ==h== H~2~O E^2^ <u>u</u> `c`";
    const doc = markdownToDoc(md);
    expect(doc.textContent).toBe(md);
    expect(docToMarkdown(doc).trim()).toBe(md);
  });

  it("nests marks — code inside strong", () => {
    const doc = markdownToDoc("**a `b` c**");
    expect(doc.textContent).toBe("**a `b` c**");
    const runs = textRuns(doc);
    expect(runs.every((r) => r[1].includes("strong"))).toBe(true);
    expect(runs.find((r) => r[0] === "b")?.[1]).toContain("code");
  });

  it("treats backtick content as opaque — no nested emphasis", () => {
    const runs = textRuns(markdownToDoc("`a*b*c`"));
    expect(runs.some((r) => r[1].includes("em"))).toBe(false);
    expect(runs.find((r) => r[0] === "a*b*c")?.[1]).toEqual(["code"]);
  });

  it("leaves unbalanced markers as plain text", () => {
    expect(textRuns(markdownToDoc("**x"))).toEqual([["**x", []]]);
  });

  it("does not format inside a fenced code block", () => {
    const doc = markdownToDoc("```\n**not bold**\n```");
    const runs = textRuns(doc);
    expect(runs.some((r) => r[1].length > 0)).toBe(false);
  });
});
