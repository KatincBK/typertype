import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Node } from "prosemirror-model";
import { markdownToDoc } from "@/editor/serializer";
import { clearFormat, toggleMarker } from "@/editor/commands";
import { schema } from "@/editor/schema";

// Faz C commands edit the marker TEXT; liveFormat (not in the loop here)
// re-derives the marks. So these tests assert the text transformation —
// mark derivation is covered by liveFormat.test.ts.
function run(
  md: string,
  command: Command,
  from: number,
  to = from,
): string | null {
  const doc = markdownToDoc(md);
  const state = EditorState.create({
    doc,
    selection: TextSelection.create(doc, from, to),
  });
  let captured: Node | undefined;
  const ok = command(state, (tr) => {
    captured = state.apply(tr).doc;
  });
  return ok && captured ? captured.textContent : null;
}

const strong = toggleMarker("strong", "**", "**");
const underline = toggleMarker("underline", "<u>", "</u>");

describe("toggleMarker", () => {
  it("wraps a plain selection with the marker text", () => {
    // "Berkay" occupies [1,7]
    expect(run("Berkay", strong, 1, 7)).toBe("**Berkay**");
  });

  it("inserts an empty marker pair at a collapsed caret", () => {
    expect(run("ab", strong, 2)).toBe("a****b");
  });

  it("strips the run's markers when the caret is inside a styled span", () => {
    // markdownToDoc gives "**Berkay**" the strong mark; caret at 5 is in "Berkay"
    expect(run("**Berkay**", strong, 5)).toBe("Berkay");
  });

  it("strips the markers when the inner text is selected", () => {
    expect(run("**Berkay**", strong, 3, 9)).toBe("Berkay");
  });

  it("handles multi-character markers (underline)", () => {
    // "<u>x</u>" — underline mark over the whole thing; "x" is at [4,5]
    expect(run("<u>x</u>", underline, 4, 5)).toBe("x");
  });
});

describe("clearFormat", () => {
  it("deletes every marker in the runs overlapping the selection", () => {
    // "**a `b` c**" — outer strong + nested code; selection on "b"
    expect(run("**a `b` c**", clearFormat(schema), 6, 7)).toBe("a b c");
  });

  it("leaves unformatted text untouched", () => {
    expect(run("plain", clearFormat(schema), 1, 6)).toBe("plain");
  });
});
