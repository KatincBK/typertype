import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { markdownToDoc } from "@/editor/serializer";
import { computeMarkupDecorations } from "@/editor/markupVisibility";

// computeMarkupDecorations is the pure core of the markup-visibility plugin:
// given a state (doc + selection) it returns the `display:none` decorations
// for the marker characters that should be collapsed. The blurred-editor
// "hide everything" case is CSS-only, so it isn't covered here.

function hiddenFor(md: string, from: number, to = from) {
  const doc = markdownToDoc(md);
  const state = EditorState.create({
    doc,
    selection: TextSelection.create(doc, from, to),
  });
  return computeMarkupDecorations(state).find();
}

describe("computeMarkupDecorations", () => {
  it("hides both markers when the caret is outside the styled span", () => {
    // "x **bold**" — strong run [3,11]; the two `**` sit at [3,5] and [9,11]
    const decos = hiddenFor("x **bold**", 2); // caret in the leading "x "
    expect(decos).toHaveLength(2);
    expect(decos.map((d) => [d.from, d.to]).sort()).toEqual([
      [3, 5],
      [9, 11],
    ]);
  });

  it("reveals the markers when the caret is inside the span", () => {
    expect(hiddenFor("x **bold**", 7)).toHaveLength(0); // caret in "bold"
  });

  it("reveals the markers at the span boundaries", () => {
    expect(hiddenFor("x **bold**", 3)).toHaveLength(0);
    expect(hiddenFor("x **bold**", 11)).toHaveLength(0);
  });

  it("reveals nested markers when the caret is anywhere in the outer span", () => {
    // caret in the plain "a " part still reveals the nested `b` backticks
    expect(hiddenFor("**a `b` c**", 4)).toHaveLength(0);
  });

  it("hides nested markers too when the caret is fully outside", () => {
    // "z **a `b` c**" — outer strong + inner code; caret in the "z " prefix
    expect(hiddenFor("z **a `b` c**", 1)).toHaveLength(4); // two `**` + two `
  });

  it("emits nothing for a document with no markup", () => {
    expect(hiddenFor("plain text", 3)).toHaveLength(0);
  });
});
