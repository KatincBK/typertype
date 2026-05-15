import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

// Adım 12b — toggle a `has-cursor` class on math_block / code_block (incl.
// mermaid) DOM nodes whenever the caret enters them. The CSS in editor.css
// uses this class to swap between the editable source pane and the rendered
// preview, matching Typora's source-vs-rendered behavior. math_inline is an
// atom (no caret can land inside) so it's intentionally skipped — it keeps
// its click-to-edit prompt for now.
const TARGET_TYPES = new Set(["math_block", "code_block"]);

export function buildFocusBlockPlugin(): Plugin {
  return new Plugin({
    view(editorView: EditorView) {
      let lastFocused: HTMLElement | null = null;
      const apply = (view: EditorView) => {
        const { from, to } = view.state.selection;
        let foundEl: HTMLElement | null = null;
        view.state.doc.descendants((node, pos) => {
          if (!TARGET_TYPES.has(node.type.name)) return;
          const start = pos;
          const end = pos + node.nodeSize;
          if (from >= start && to <= end) {
            const dom = view.nodeDOM(pos) as HTMLElement | null;
            if (dom) foundEl = dom;
          }
        });
        if (lastFocused === foundEl) return;
        if (lastFocused) lastFocused.classList.remove("has-cursor");
        if (foundEl) (foundEl as HTMLElement).classList.add("has-cursor");
        lastFocused = foundEl;
      };
      apply(editorView);
      return {
        update(view, prevState) {
          // Only re-scan when something that can change which block holds the
          // caret actually changed. Running on every transaction (incl. plugin
          // decoration updates) caused a feedback loop: toggling `has-cursor`
          // flips CSS `display:none` on the contentDOM, which in turn triggers
          // a PM re-sync, which is another update… and so on.
          if (
            prevState.selection.eq(view.state.selection) &&
            prevState.doc.eq(view.state.doc)
          ) {
            return;
          }
          apply(view);
        },
        destroy() {
          if (lastFocused) lastFocused.classList.remove("has-cursor");
        },
      };
    },
  });
}
