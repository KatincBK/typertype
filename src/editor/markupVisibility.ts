import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// Faz B — the Typora reveal/hide behaviour. The `markup` marker characters
// (`**` `*` `~~` …) are real text in the document (Faz A); this plugin hides
// them with a `display:none` decoration whenever the caret is NOT inside the
// styled span they belong to, and reveals them when it is.
//
// A marker character is VISIBLE when the selection touches any style-mark run
// that contains it — so clicking anywhere inside `**a `b` c**` reveals the
// whole thing, nested markers included. When the editor is blurred, CSS hides
// every `.md-markup` outright (`.ProseMirror:not(.ProseMirror-focused)`), so
// the visibility decoration only has to handle the focused case.

export const markupVisibilityKey = new PluginKey<DecorationSet>(
  "markupVisibility",
);

// Style marks whose runs gate marker visibility. `markup` itself and `link`
// are intentionally excluded.
const STYLE_MARKS = new Set([
  "strong",
  "em",
  "strikethrough",
  "highlight",
  "code",
  "subscript",
  "superscript",
  "underline",
]);

interface Range {
  from: number;
  to: number;
}

export function computeMarkupDecorations(state: EditorState): DecorationSet {
  const { doc, selection } = state;
  const markupType = state.schema.marks.markup;
  if (!markupType) return DecorationSet.empty;

  const selFrom = selection.from;
  const selTo = selection.to;

  // Pass 1 — collect the style-mark runs the selection touches.
  const activeRanges: Range[] = [];
  const openRuns = new Map<string, Range>();
  const closeRun = (name: string) => {
    const run = openRuns.get(name);
    if (!run) return;
    openRuns.delete(name);
    // touched (endpoints included) → this run's markers stay visible
    if (run.from <= selTo && run.to >= selFrom) activeRanges.push(run);
  };
  const closeAll = () => {
    for (const name of [...openRuns.keys()]) closeRun(name);
  };

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const end = pos + node.nodeSize;
      const present = new Set<string>();
      for (const m of node.marks) {
        if (STYLE_MARKS.has(m.type.name)) present.add(m.type.name);
      }
      for (const name of [...openRuns.keys()]) {
        if (!present.has(name)) closeRun(name);
      }
      for (const name of present) {
        const run = openRuns.get(name);
        if (run) run.to = end;
        else openRuns.set(name, { from: pos, to: end });
      }
      return false;
    }
    // any non-text node (block boundary, inline atom) ends every run
    closeAll();
    return undefined;
  });
  closeAll();

  // Pass 2 — hide every `markup` text node not covered by an active run.
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !markupType.isInSet(node.marks)) return;
    const from = pos;
    const to = pos + node.nodeSize;
    const covered = activeRanges.some((r) => from >= r.from && to <= r.to);
    if (!covered) {
      decorations.push(
        Decoration.inline(from, to, { class: "md-markup-hidden" }),
      );
    }
  });

  return decorations.length
    ? DecorationSet.create(doc, decorations)
    : DecorationSet.empty;
}

export function buildMarkupVisibilityPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: markupVisibilityKey,
    state: {
      init: (_config, state) => computeMarkupDecorations(state),
      apply: (tr, value, _oldState, newState) => {
        if (tr.docChanged || tr.selectionSet) {
          return computeMarkupDecorations(newState);
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        return markupVisibilityKey.getState(state);
      },
    },
  });
}
