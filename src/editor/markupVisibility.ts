import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node } from "prosemirror-model";

// Faz B — the Typora reveal/hide behaviour. The `markup` marker characters
// (`**` `*` `~~` `==` `` ` `` `~` `^` `<u></u>`) are real text in the document
// (Faz A); this plugin hides them with a `display:none` decoration whenever
// the caret is NOT inside the styled span they belong to, and reveals them
// when it is.
//
// A marker character is VISIBLE when the selection touches any style-mark run
// that contains it — so clicking anywhere inside `**a `b` c**` reveals the
// whole thing, nested markers included. When the editor is blurred, CSS hides
// every `.md-markup` outright (`.ProseMirror:not(.ProseMirror-focused)`), so
// the visibility decoration only has to handle the focused case.

export const markupVisibilityKey = new PluginKey<DecorationSet>(
  "markupVisibility",
);

// Style marks whose runs gate marker visibility / editing commands. `markup`
// itself and `link` are intentionally excluded.
export const STYLE_MARKS = new Set([
  "strong",
  "em",
  "strikethrough",
  "highlight",
  "code",
  "subscript",
  "superscript",
  "underline",
]);

export interface StyleRun {
  markName: string;
  from: number;
  to: number;
}

// Every maximal contiguous run of each style mark in the document. Shared by
// the visibility plugin and the Faz C editing commands (toggleMarker /
// clearFormat). Runs never span a block boundary or an inline atom.
export function collectStyleRuns(doc: Node): StyleRun[] {
  const runs: StyleRun[] = [];
  const open = new Map<string, StyleRun>();
  const closeAll = () => {
    for (const run of open.values()) runs.push(run);
    open.clear();
  };
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const end = pos + node.nodeSize;
      const present = new Set<string>();
      for (const m of node.marks) {
        if (STYLE_MARKS.has(m.type.name)) present.add(m.type.name);
      }
      for (const [name, run] of [...open]) {
        if (!present.has(name)) {
          runs.push(run);
          open.delete(name);
        }
      }
      for (const name of present) {
        const run = open.get(name);
        if (run) run.to = end;
        else open.set(name, { markName: name, from: pos, to: end });
      }
      return false;
    }
    // any non-text node (block boundary, inline atom) ends every run
    closeAll();
    return undefined;
  });
  closeAll();
  return runs;
}

export function computeMarkupDecorations(state: EditorState): DecorationSet {
  const { doc, selection } = state;
  const markupType = state.schema.marks.markup;
  if (!markupType) return DecorationSet.empty;

  const selFrom = selection.from;
  const selTo = selection.to;

  // Style-mark runs the selection touches (endpoints included) stay revealed.
  const activeRuns = collectStyleRuns(doc).filter(
    (r) => r.from <= selTo && r.to >= selFrom,
  );

  // Hide every `markup` text node not covered by an active run.
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !markupType.isInSet(node.marks)) return;
    const from = pos;
    const to = pos + node.nodeSize;
    const covered = activeRuns.some((r) => from >= r.from && to <= r.to);
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
