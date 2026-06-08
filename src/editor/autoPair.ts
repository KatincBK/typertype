import { Plugin, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import { liftListItem } from "prosemirror-schema-list";
import { joinTextblockBackward } from "prosemirror-commands";

// Adım 5 — Auto-pair brackets. Quotes (' ") are deliberately excluded so
// smartQuotes input rules can convert them to curly equivalents. Markdown
// formatting chars (* _ ~ ` = ^) are excluded because the live-format plugin
// owns those — auto-pairing them would create runaway delimiter sequences.
const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

const CLOSERS = new Set(Object.values(PAIRS));

export function buildAutoPairPlugin(): Plugin {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (text.length !== 1) return false;
        const { state } = view;
        const { selection, doc } = state;

        // Skip-over: typing a closer when the next char already is that
        // closer (likely produced by a previous auto-pair) just moves the
        // caret past it.
        if (CLOSERS.has(text) && selection.empty) {
          const after = doc.textBetween(from, Math.min(from + 1, doc.content.size));
          if (after === text) {
            view.dispatch(
              state.tr.setSelection(TextSelection.create(state.doc, from + 1)),
            );
            return true;
          }
        }

        const close = PAIRS[text];
        if (!close) return false;

        if (selection.empty) {
          const tr = state.tr.insertText(text + close, from, to);
          tr.setSelection(TextSelection.create(tr.doc, from + 1));
          view.dispatch(tr);
          return true;
        }

        // Wrap selection: insert opener at start, closer at mapped end. Two
        // separate inserts preserve the selected slice (and its marks).
        let tr = state.tr.insertText(text, from, from);
        const closerPos = tr.mapping.map(to);
        tr = tr.insertText(close, closerPos, closerPos);
        tr.setSelection(TextSelection.create(tr.doc, from + 1, closerPos));
        view.dispatch(tr);
        return true;
      },
    },
  });
}

export const backspaceEmptyPair: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty) return false;
  if ($from.parentOffset === 0) return false;
  if (!$from.parent.isTextblock) return false;
  const text = $from.parent.textContent;
  const offset = $from.parentOffset;
  const before = text[offset - 1];
  const after = text[offset];
  // Only fire for an actual auto-paired bracket: an opener immediately followed
  // by its matching closer (e.g. `(|)`), deleting BOTH. `close` must be defined,
  // which also guards the end-of-textblock case where `after` is undefined.
  // The earlier bare `PAIRS[before] === after` compared `undefined === undefined`
  // there and fired on a plain character at a block end, running a destructive
  // delete($from.pos - 1, $from.pos + 1) that crossed the block boundary and
  // dragged the caret into the next block (e.g. the next list item).
  const close = before ? PAIRS[before] : undefined;
  if (close !== undefined && close === after) {
    if (dispatch) {
      dispatch(state.tr.delete($from.pos - 1, $from.pos + 1));
    }
    return true;
  }
  return false;
};

// Backspace at the very start of a list item's content. Without this the chain
// falls through to baseKeymap's joinBackward, which in ordered/bullet lists
// drags the item out as a loose, un-numbered continuation paragraph
// (`1. abc\n\n   def`). Typora behaviour depends on whether the item is first
// in its list:
//   - FIRST item  → outdent one level (liftListItem): a nested item rejoins its
//     parent list, a top-level item becomes a plain paragraph.
//   - LATER item  → merge into the previous item as one tight paragraph
//     (joinTextblockBackward). The earlier all-items-lift fix dropped these
//     items onto a line below the list ("alt satıra geçiyor") instead.
// Only fires when the caret sits at the start of the FIRST child of a
// list_item — mid-text Backspace still deletes a character.
//
// NOTE: joinTextblockBackward is called WITHOUT the view on purpose. With a
// view it gates on view.endOfTextblock("backward"), which the list drag-handle
// widget (rendered just before each item's paragraph) makes return false — so
// the join was silently falling through to baseKeymap's joinBackward, which
// merges as a LOOSE second paragraph and parks the caret at the start of that
// lower line ("alt satırdaki öncülün başına geçiyor"). Dropping the view makes
// atBlockStart use the parentOffset===0 fallback we've already asserted, so the
// tight upward merge always fires.
export function listItemBackspaceOutdent(schema: Schema): Command {
  const listItem = schema.nodes.list_item;
  if (!listItem) return () => false;
  const lift = liftListItem(listItem);
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;
    if ($from.parentOffset !== 0) return false;
    if ($from.depth < 2) return false;
    if ($from.node($from.depth - 1).type !== listItem) return false;
    if ($from.index($from.depth - 1) !== 0) return false;
    // First item in its (sub)list outdents; any later item joins upward.
    if ($from.index($from.depth - 2) === 0) {
      return lift(state, dispatch);
    }
    return joinTextblockBackward(state, dispatch);
  };
}
