import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import type { Node } from "prosemirror-model";
import { markdownToDoc, docToMarkdown } from "@/editor/serializer";
import { moveListItem } from "@/editor/listDrag";

// listDrag's pointer/DOM plumbing can't run under jsdom, but the reorder
// transform (moveListItem) is pure and is exercised here.

function itemPositions(doc: Node): number[] {
  const ps: number[] = [];
  doc.descendants((node: Node, pos: number) => {
    if (node.type.name === "list_item") ps.push(pos);
    return true;
  });
  return ps;
}

function move(
  md: string,
  fromIdx: number,
  toIdx: number,
  side: "before" | "after",
): string | null {
  const doc = markdownToDoc(md);
  const state = EditorState.create({ doc });
  const items = itemPositions(doc);
  const tr = moveListItem(state, items[fromIdx], { pos: items[toIdx], side });
  return tr ? docToMarkdown(state.apply(tr).doc) : null;
}

describe("moveListItem", () => {
  it("moves the last item to the top", () => {
    expect(move("1. a\n2. b\n3. c", 2, 0, "before")).toBe("1. c\n2. a\n3. b");
  });

  it("moves the first item after the last", () => {
    expect(move("1. a\n2. b\n3. c", 0, 2, "after")).toBe("1. b\n2. c\n3. a");
  });

  it("swaps two adjacent items (move first after second)", () => {
    expect(move("1. a\n2. b\n3. c", 0, 1, "after")).toBe("1. b\n2. a\n3. c");
  });

  it("reorders bullet items too", () => {
    // serializer normalises bullets to '*'
    expect(move("- a\n- b\n- c", 2, 0, "before")).toBe("* c\n* a\n* b");
  });

  it("reorders within a nested sublist", () => {
    const out = move("1. a\n   1. x\n   2. y\n2. b", 2, 1, "before");
    expect(out).toBe("1. a\n   1. y\n   2. x\n2. b");
  });

  it("is a no-op when dropped onto its own slot (before itself)", () => {
    expect(move("1. a\n2. b\n3. c", 1, 1, "before")).toBeNull();
  });

  it("is a no-op when dropped after itself", () => {
    expect(move("1. a\n2. b\n3. c", 1, 1, "after")).toBeNull();
  });

  it("is a no-op when the item is already before the target", () => {
    // 'a' is already immediately before 'b'.
    expect(move("1. a\n2. b\n3. c", 0, 1, "before")).toBeNull();
  });
});
