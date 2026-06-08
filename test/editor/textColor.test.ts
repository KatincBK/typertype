import { describe, expect, it } from "vitest";
import type { Node } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { markdownToDoc, docToMarkdown } from "@/editor/serializer";
import { applyTextColor, currentTextColor } from "@/editor/textColor";

function colorOf(doc: Node, word: string): string | null {
  let color: string | null = null;
  doc.descendants((node: Node) => {
    if (node.isText && node.text === word) {
      const m = node.marks.find((mk) => mk.type.name === "textColor");
      if (m) color = m.attrs.color as string;
    }
  });
  return color;
}

describe("textColor round-trip", () => {
  it("parses <span style=color> into a textColor mark", () => {
    const doc = markdownToDoc('a <span style="color: #e03131">red</span> b');
    expect(colorOf(doc, "red")).toBe("#e03131");
  });

  it("parses a named color too", () => {
    const doc = markdownToDoc('x <span style="color: blue">sky</span> y');
    expect(colorOf(doc, "sky")).toBe("blue");
  });

  it("serializes the mark back to an inline span", () => {
    const doc = markdownToDoc('a <span style="color: #e03131">red</span> b');
    expect(docToMarkdown(doc)).toContain(
      '<span style="color: #e03131">red</span>',
    );
  });

  it("is stable across a second round-trip", () => {
    const md = 'a <span style="color: blue">x</span> b';
    const once = docToMarkdown(markdownToDoc(md));
    const twice = docToMarkdown(markdownToDoc(once));
    expect(twice).toBe(once);
  });

  it("leaves plain text without a color mark", () => {
    expect(colorOf(markdownToDoc("just text"), "just text")).toBeNull();
  });
});

function selecting(md: string, word: string): EditorState {
  const doc = markdownToDoc(md);
  let from = -1;
  doc.descendants((node: Node, p: number) => {
    if (node.isText && from === -1) {
      const idx = (node.text ?? "").indexOf(word);
      if (idx !== -1) from = p + idx;
    }
  });
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, from, from + word.length),
  });
}

describe("applyTextColor command", () => {
  it("colours the selection and reports the current color", () => {
    let next: EditorState | null = null;
    const state = selecting("hello world", "world");
    const ok = applyTextColor("#1971c2")(state, (tr) => {
      next = state.apply(tr);
    });
    expect(ok).toBe(true);
    expect(currentTextColor(next as unknown as EditorState)).toBe("#1971c2");
    expect(colorOf((next as unknown as EditorState).doc, "world")).toBe("#1971c2");
  });

  it("clears the color when passed null", () => {
    const colored = selecting('a <span style="color: red">x</span> b', "x");
    let next: EditorState | null = null;
    applyTextColor(null)(colored, (tr) => {
      next = colored.apply(tr);
    });
    expect(colorOf((next as unknown as EditorState).doc, "x")).toBeNull();
  });

  it("is a no-op on an empty selection", () => {
    const doc = markdownToDoc("hello");
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1),
    });
    expect(applyTextColor("#000")(state, undefined)).toBe(false);
  });
});
