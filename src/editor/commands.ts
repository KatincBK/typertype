import { TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import { setBlockType } from "prosemirror-commands";
import { Fragment } from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import { docToMarkdown } from "./serializer";

// Custom commands for Typora-parity shortcuts (Adım 4).
// Stateless helpers receive the schema where needed and return a Command so
// keymap.ts can wire them up.

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
  const mark = marks[0];

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
    const url = window.prompt("Bağlantı URL'si:");
    if (!url) return true;
    if (dispatch) {
      dispatch(state.tr.addMark(from, to, linkType.create({ href: url })));
    }
    return true;
  };

export const clearFormat =
  (schema: Schema): Command =>
  (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      let tr = state.tr;
      for (const name in schema.marks) {
        tr = tr.removeMark(from, to, schema.marks[name]);
      }
      dispatch(tr);
    }
    return true;
  };
