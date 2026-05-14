import { TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import { setBlockType } from "prosemirror-commands";
import { Fragment } from "prosemirror-model";
import type { Node, Schema } from "prosemirror-model";
import { docToMarkdown } from "./serializer";
import { collectStyleRuns } from "./markupVisibility";
import i18n from "@/lib/i18n";

// Custom commands for Typora-parity shortcuts (Adım 4).
// Stateless helpers receive the schema where needed and return a Command so
// keymap.ts can wire them up.

// Faz C — in the literal-marker model the inline-formatting shortcuts (Ctrl+B
// etc.) edit the marker TEXT, not a mark; liveFormat then re-derives the mark.
// `findMarkRun` locates the maximal run of a style mark around a position.
function findMarkRun(doc: Node, pos: number, markName: string) {
  return (
    collectStyleRuns(doc).find(
      (r) => r.markName === markName && r.from <= pos && pos <= r.to,
    ) ?? null
  );
}

// Toggle an inline format: if the caret/selection is already inside that
// mark's run, delete the run's own opening/closing marker text; otherwise
// wrap the selection (or insert an empty pair) with the marker text.
export const toggleMarker =
  (markName: string, open: string, close: string): Command =>
  (state, dispatch) => {
    const markType = state.schema.marks[markName];
    if (!markType) return false;
    const { from, to, empty, $from, $to } = state.selection;

    const active = empty
      ? markType.isInSet(state.storedMarks || $from.marks())
      : state.doc.rangeHasMark(from, to, markType);

    if (active) {
      // Toggle OFF — strip this run's own marker text.
      const run = findMarkRun(state.doc, from, markName);
      if (!run) return false;
      // Defensive: the run edges must actually be the marker text.
      if (
        state.doc.textBetween(run.from, run.from + open.length) !== open ||
        state.doc.textBetween(run.to - close.length, run.to) !== close
      ) {
        return false;
      }
      if (dispatch) {
        const tr = state.tr;
        tr.delete(run.to - close.length, run.to);
        tr.delete(run.from, run.from + open.length);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Toggle ON — markers can't straddle a block boundary.
    if (!empty && !$from.sameParent($to)) return false;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        tr.insertText(open + close, from);
        tr.setSelection(TextSelection.create(tr.doc, from + open.length));
      } else {
        tr.insertText(open, from);
        const mappedTo = tr.mapping.map(to);
        tr.insertText(close, mappedTo);
        tr.setSelection(
          TextSelection.create(tr.doc, from + open.length, mappedTo),
        );
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };

export const softBreak =
  (schema: Schema): Command =>
  (state, dispatch) => {
    const br = schema.nodes.hard_break;
    if (!br) return false;
    const { $from } = state.selection;
    if (!$from.parent.canReplaceWith($from.index(), $from.indexAfter(), br)) {
      return false;
    }
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
    }
    return true;
  };

export const copyAsMarkdown =
  (schema: Schema): Command =>
  (state) => {
    if (state.selection.empty) return false;
    const docType = schema.nodes.doc;
    const paraType = schema.nodes.paragraph;
    if (!docType) return false;

    let content = state.selection.content().content;
    if (content.firstChild && !content.firstChild.isBlock) {
      if (!paraType) return false;
      content = Fragment.from(paraType.create(null, content));
    }

    let docNode;
    try {
      docNode = docType.create(null, content);
    } catch {
      return false;
    }
    const md = docToMarkdown(docNode);
    void navigator.clipboard.writeText(md).catch(() => {});
    return true;
  };

export const pasteAsPlainText: Command = (_state, _dispatch, view) => {
  if (!view) return false;
  void navigator.clipboard
    .readText()
    .then((text) => {
      if (!text) return;
      const tr = view.state.tr.insertText(
        text,
        view.state.selection.from,
        view.state.selection.to,
      );
      view.dispatch(tr.scrollIntoView());
    })
    .catch(() => {});
  return true;
};

export const selectLine: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  if ($from.parent !== $to.parent) return false;
  const start = $from.start();
  const end = $from.end();
  if (state.selection.from === start && state.selection.to === end) return false;
  if (dispatch) {
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, end)));
  }
  return true;
};

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export const selectWord: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const text = $from.parent.textContent;
  if (!text) return false;
  const offset = $from.parentOffset;
  let start = offset;
  let end = offset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;
  if (start === end) return false;
  const blockStart = $from.start();
  if (dispatch) {
    dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, blockStart + start, blockStart + end),
      ),
    );
  }
  return true;
};

export const selectStyleScope: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const marks = $from.marks();
  if (marks.length === 0) return false;
  // Prefer a style mark over `markup` so Mod-e selects the whole `**bold**`
  // span (markers included), not just a bare `**`.
  const mark = marks.find((m) => m.type.name !== "markup") ?? marks[0];

  const blockStart = $from.start();
  const blockEnd = $from.end();
  let start = $from.pos;
  let end = $from.pos;

  while (start > blockStart) {
    const $pos = state.doc.resolve(start - 1);
    if (!mark.isInSet($pos.marks())) break;
    start--;
  }
  while (end < blockEnd) {
    const $pos = state.doc.resolve(end);
    if (!mark.isInSet($pos.marks())) break;
    end++;
  }
  if (start === end) return false;
  if (dispatch) {
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, end)));
  }
  return true;
};

export const jumpToSelection: Command = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.scrollIntoView());
  return true;
};

export const increaseHeadingLevel =
  (schema: Schema): Command =>
  (state, dispatch) => {
    const headingType = schema.nodes.heading;
    const paraType = schema.nodes.paragraph;
    if (!headingType) return false;
    const node = state.selection.$from.parent;
    if (node.type === headingType) {
      const level = node.attrs.level as number;
      if (level <= 1) return true;
      return setBlockType(headingType, { level: level - 1 })(state, dispatch);
    }
    if (paraType && node.type === paraType) {
      return setBlockType(headingType, { level: 6 })(state, dispatch);
    }
    return false;
  };

export const decreaseHeadingLevel =
  (schema: Schema): Command =>
  (state, dispatch) => {
    const headingType = schema.nodes.heading;
    const paraType = schema.nodes.paragraph;
    if (!headingType) return false;
    const node = state.selection.$from.parent;
    if (node.type !== headingType) return false;
    const level = node.attrs.level as number;
    if (level >= 6) {
      if (!paraType) return false;
      return setBlockType(paraType)(state, dispatch);
    }
    return setBlockType(headingType, { level: level + 1 })(state, dispatch);
  };

export const insertLink =
  (schema: Schema): Command =>
  (state, dispatch) => {
    const linkType = schema.marks.link;
    if (!linkType) return false;
    const { from, to, empty } = state.selection;
    if (empty) return false;
    // MVP: window.prompt — gerçek modal Adım 13 sonrası UI fazında gelecek
    const url = window.prompt(i18n.t("commands.linkPrompt"));
    if (!url) return true;
    if (dispatch) {
      dispatch(state.tr.addMark(from, to, linkType.create({ href: url })));
    }
    return true;
  };

export const clearFormat =
  (_schema: Schema): Command =>
  (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    const markupType = state.schema.marks.markup;
    const linkType = state.schema.marks.link;

    // Style-mark runs overlapping the selection — all their marker text
    // (including nested markers) gets deleted, which makes liveFormat drop
    // the derived marks on the next reparse.
    const affected = collectStyleRuns(state.doc).filter(
      (r) => r.from < to && r.to > from,
    );

    if (dispatch) {
      const tr = state.tr;
      if (markupType && affected.length) {
        const toDelete: Array<{ from: number; to: number }> = [];
        state.doc.descendants((node, pos) => {
          if (!node.isText || !markupType.isInSet(node.marks)) return;
          const nFrom = pos;
          const nTo = pos + node.nodeSize;
          if (affected.some((r) => nFrom >= r.from && nTo <= r.to)) {
            toDelete.push({ from: nFrom, to: nTo });
          }
        });
        // Delete end → start so earlier offsets stay valid.
        for (let i = toDelete.length - 1; i >= 0; i--) {
          tr.delete(toDelete[i].from, toDelete[i].to);
        }
      }
      // `link` is still on the old consumed-marker model — drop it directly.
      if (linkType) {
        tr.removeMark(tr.mapping.map(from), tr.mapping.map(to), linkType);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
