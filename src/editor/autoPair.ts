import { Plugin, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import { liftListItem } from "prosemirror-schema-list";

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
  if (before && PAIRS[before] === after) {
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
// (`1. abc\n\n   def`) — the cursor appears to jump to a lower line / lose its
// number. Typora instead outdents the item one level: a nested item rejoins
// its parent list, a top-level item becomes a plain paragraph. liftListItem
// does exactly that. Only fires when the caret sits at the start of the FIRST
// child of a list_item — mid-text Backspace still deletes a character.
export function listItemBackspaceOutdent(schema: Schema): Command {
  const listItem = schema.nodes.list_item;
  if (!listItem) return () => false;
  const lift = liftListItem(listItem);
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;
    if ($from.parentOffset !== 0) return false;
    if ($from.depth < 1) return false;
    if ($from.node($from.depth - 1).type !== listItem) return false;
    if ($from.index($from.depth - 1) !== 0) return false;
    return lift(state, dispatch);
  };
}
