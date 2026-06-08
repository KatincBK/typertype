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

function applyState(state: EditorState): EditorState | null {
  let next: EditorState | null = null;
  const ok = cmd(state, (tr) => {
    next = state.apply(tr);
  });
  return ok ? next : null;
}

describe("listItemBackspaceOutdent", () => {
  // Guards the production path: the merge must be a TIGHT single paragraph with
  // the caret at the junction — not joinBackward's loose second paragraph that
  // parked the caret at the start of the line below ("alt satıra geçiyor"). The
  // command must therefore call joinTextblockBackward without a view so the
  // drag-handle widget can't veto it via endOfTextblock.
  it("merges into a single (tight) paragraph with the caret at the junction", () => {
    const next = applyState(caretAt("1. a\n2. b\n3. c\n4. d", "d"));
    expect(next).not.toBeNull();
    const state = next as EditorState;
    // The third item now holds the merged text in ONE paragraph.
    let merged: Node | null = null;
    state.doc.descendants((node: Node) => {
      if (node.type.name === "list_item" && node.textContent === "cd") merged = node;
    });
    expect(merged).not.toBeNull();
    expect((merged as unknown as Node).childCount).toBe(1); // tight: no loose 2nd <p>
    // Caret sits between 'c' and 'd', not at the start of a lower line.
    const $c = state.doc.resolve(state.selection.from);
    expect($c.parent.textContent).toBe("cd");
    expect($c.parentOffset).toBe(1);
  });

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

describe("backspaceEmptyPair", () => {
  // Place the caret at the END of `word` (its last char's textblock end).
  function caretAfter(md: string, word: string): EditorState {
    const doc = markdownToDoc(md);
    let pos = -1;
    doc.descendants((node: Node, p: number) => {
      if (node.isText && node.text === word && pos === -1) pos = p + node.nodeSize;
    });
    if (pos === -1) throw new Error(`text ${JSON.stringify(word)} not found`);
    return EditorState.create({ doc, selection: TextSelection.create(doc, pos) });
  }

  // Regression: at the END of a list item the caret has no char after it, so
  // `after` is undefined. The old `PAIRS[before] === after` check compared
  // undefined === undefined and fired a destructive delete that crossed the
  // block boundary, dropping the caret at the start of the NEXT item
  // ("2." ↔ "Yemek" junction). It must now return false → native single-char
  // deletion handles it.
  it("does NOT fire at the end of a list item (no bracket pair)", () => {
    expect(backspaceEmptyPair(caretAfter("1. ab\n2. cd", "ab"), undefined)).toBe(
      false,
    );
  });

  it("does NOT fire at the end of a plain paragraph", () => {
    expect(backspaceEmptyPair(caretAfter("hello", "hello"), undefined)).toBe(false);
  });

  it("still deletes both chars of a real auto-paired bracket", () => {
    // paragraph "()" with the caret between the brackets.
    const doc = markdownToDoc("()");
    let pos = -1;
    doc.descendants((node: Node, p: number) => {
      if (node.isText && node.text === "()") pos = p + 1; // between '(' and ')'
    });
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, pos),
    });
    let out: string | null = null;
    const ok = backspaceEmptyPair(state, (tr) => {
      out = docToMarkdown(state.apply(tr).doc);
    });
    expect(ok).toBe(true);
    expect(out).toBe("");
  });
});
