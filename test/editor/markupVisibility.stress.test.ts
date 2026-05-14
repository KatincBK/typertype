import { describe, expect, it } from "vitest";
import { EditorState, Selection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownToDoc } from "@/editor/serializer";
import { buildLiveFormatPlugin } from "@/editor/liveFormat";
import { buildMarkupVisibilityPlugin } from "@/editor/markupVisibility";
import { schema } from "@/editor/schema";

// Regression guard: the app froze when clicking into a block element. This
// mounts a real EditorView with the rewrite's two new plugins and walks the
// selection through every position in a doc full of block elements (code
// block, blockquote, hr, heading) and styled spans — catching any exception
// or infinite loop in markupVisibility / liveFormat on a selection change.
// (jsdom has no layout, so this only catches JS-level bugs, not CSS ones.)

const SAMPLE = [
  "# Block Elementler",
  "",
  "> a blockquote with **bold** inside",
  "",
  "```",
  "function hello() { return 1; }",
  "```",
  "",
  "Some **bold** and `code` and *italic* and ~~strike~~ text.",
  "",
  "---",
  "",
  "## Another heading",
  "",
  "Trailing paragraph.",
].join("\n");

describe("markupVisibility + liveFormat selection stress", () => {
  it("survives a selection sweep across every block without throwing or hanging", () => {
    const place = document.createElement("div");
    document.body.appendChild(place);
    const view = new EditorView(place, {
      state: EditorState.create({
        doc: markdownToDoc(SAMPLE),
        plugins: [buildLiveFormatPlugin(schema), buildMarkupVisibilityPlugin()],
      }),
    });
    try {
      const size = view.state.doc.content.size;
      for (let pos = 0; pos <= size; pos++) {
        const sel = Selection.near(view.state.doc.resolve(pos));
        view.dispatch(view.state.tr.setSelection(sel));
      }
      // doc must be untouched — these are selection-only transactions
      expect(view.state.doc.content.size).toBe(size);
    } finally {
      view.destroy();
      place.remove();
    }
  });
});
