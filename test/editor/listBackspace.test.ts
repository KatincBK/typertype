import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Node } from "prosemirror-model";
import { markdownToDoc, docToMarkdown } from "@/editor/serializer";
import { listItemBackspaceOutdent, backspaceEmptyPair } from "@/editor/autoPair";
import { schema } from "@/editor/schema";

// Backspace at the start of a list item must outdent (Typora behaviour),
// not let joinBackward drag the item out as a loose `1. abc\n\n   def`
// continuation paragraph. These exercise the command directly at the doc
// position where the relevant text starts.

const cmd = listItemBackspaceOutdent(schema);

function caretAt(md: string, word: string): EditorState {
  const doc = markdownToDoc(md);
  let pos = -1;
  doc.descendants((node: Node, p: number) => {
    if (node.isText && node.text === word && pos === -1) pos = p;
  });
  if (pos === -1) throw new Error(`text ${JSON.stringify(word)} not found`);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, pos),
  });
}

function apply(state: EditorState): string | null {
  let out: string | null = null;
  const ok = cmd(state, (tr) => {
    out = docToMarkdown(state.apply(tr).doc);
  });
  return ok ? out : null;
}

describe("listItemBackspaceOutdent", () => {
  it("top-level later item → merges into the previous item (tight)", () => {
    // Typora joins the items instead of dropping 'def' onto a line below.
    expect(apply(caretAt("1. abc\n2. def", "def"))).toBe("1. abcdef");
  });

  it("third item also merges upward into the second", () => {
    expect(apply(caretAt("1. a\n2. b\n3. c", "c"))).toBe("1. a\n2. bc");
  });

  it("nested first item → outdents to the parent list level", () => {
    expect(apply(caretAt("1. abc\n   1. def", "def"))).toBe("1. abc\n2. def");
  });

  it("nested later item → merges into the previous nested item", () => {
    const out = apply(caretAt("1. abc\n   1. d\n   2. e", "e"));
    expect(out).toBe("1. abc\n   1. de");
  });

  it("first top-level item → becomes a plain paragraph above the rest", () => {
    // 'abc' lifts out; 'def' renumbers to the sole remaining item.
    const out = apply(caretAt("1. abc\n2. def", "abc"));
    expect(out).toBe("abc\n\n1. def");
  });

  it("bullet later item merges upward the same way", () => {
    // serializer normalises bullets to '*'
    expect(apply(caretAt("- abc\n- def", "def"))).toBe("* abcdef");
  });

  it("does nothing mid-text (caret not at item start)", () => {
    const doc = markdownToDoc("1. abc");
    let pos = -1;
    doc.descendants((node: Node, p: number) => {
      if (node.isText && node.text === "abc") pos = p;
    });
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, pos + 1), // between 'a' and 'b'
    });
    expect(apply(state)).toBeNull();
  });

  it("does nothing outside a list (plain paragraph start)", () => {
    expect(apply(caretAt("hello", "hello"))).toBeNull();
  });

  it("empty list item at start outdents to an empty paragraph", () => {
    // '1. \n2. def' — caret at start of the empty first item.
    const doc = markdownToDoc("1. \n2. def");
    // The empty item's paragraph is the first textblock; its start position.
    let target = -1;
    doc.descendants((node: Node, p: number) => {
      if (node.type.name === "paragraph" && node.content.size === 0 && target === -1) {
        target = p + 1;
      }
    });
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, target),
    });
    const out = apply(state);
    expect(out).not.toBeNull();
    // The empty item leaves the list; 'def' stays a (renumbered) list item.
    expect(out).toContain("1. def");
  });

  it("backspaceEmptyPair is unaffected by the new command", () => {
    // sanity: the pair helper still returns false at item start (parentOffset 0)
    const state = caretAt("1. abc", "abc");
    expect(backspaceEmptyPair(state, undefined)).toBe(false);
  });
});
