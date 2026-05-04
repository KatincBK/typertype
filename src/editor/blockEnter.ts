import { TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Schema } from "prosemirror-model";

// Block-level Enter handling. Replaces the old space-triggered input rules:
// the user now types the full marker + content on a paragraph and presses
// Enter to convert. This matches the "A tercihi" choice in TODO.md.
//
// Patterns:
//   `# ` … `###### `   → heading (level = # count)
//   `> `               → blockquote
//   `- ` / `* ` / `+ ` → bullet list
//   `1. ` (any digits) → ordered list (start = digits)
//   ```` ``` ```` (+lang) → fenced code block
//
// Cursor placement after conversion follows Typora-like ergonomics: caret
// lands on the next blank target so that the user can keep typing.

export function blockTransformEnter(schema: Schema): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;
    if ($from.parent.type !== schema.nodes.paragraph) return false;
    if ($from.depth !== 1) return false; // only top-level paragraphs

    const text = $from.parent.textContent;
    if (!text) return false;

    const blockStart = $from.before();
    const blockEnd = $from.after();

    // Heading
    const headingMatch = /^(#{1,6}) (.+)$/.exec(text);
    if (headingMatch && schema.nodes.heading) {
      if (dispatch) {
        const level = headingMatch[1].length;
        const heading = schema.nodes.heading.create(
          { level },
          schema.text(headingMatch[2]),
        );
        const para = schema.nodes.paragraph.createAndFill();
        if (!para) return false;
        const tr = state.tr.replaceWith(blockStart, blockEnd, [heading, para]);
        const cursor = blockStart + heading.nodeSize + 1;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Code block (``` or ```lang)
    const codeMatch = /^```(\S*)\s*$/.exec(text);
    if (codeMatch && schema.nodes.code_block) {
      if (dispatch) {
        const params = codeMatch[1] || "";
        const codeBlock = schema.nodes.code_block.create({ params });
        const tr = state.tr.replaceWith(blockStart, blockEnd, codeBlock);
        const cursor = blockStart + 1;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Blockquote: stay inside the quote with cursor on a fresh paragraph
    const quoteMatch = /^> (.+)$/.exec(text);
    if (quoteMatch && schema.nodes.blockquote) {
      if (dispatch) {
        const inner = schema.nodes.paragraph.create(
          {},
          schema.text(quoteMatch[1]),
        );
        const tail = schema.nodes.paragraph.createAndFill();
        if (!tail) return false;
        const blockquote = schema.nodes.blockquote.create({}, [inner, tail]);
        const tr = state.tr.replaceWith(blockStart, blockEnd, blockquote);
        const cursor = blockStart + 1 + inner.nodeSize + 1;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Bullet list
    const bulletMatch = /^[-*+] (.+)$/.exec(text);
    if (
      bulletMatch &&
      schema.nodes.bullet_list &&
      schema.nodes.list_item
    ) {
      if (dispatch) {
        const filled = schema.nodes.paragraph.create(
          {},
          schema.text(bulletMatch[1]),
        );
        const item = schema.nodes.list_item.create({}, filled);
        const next = schema.nodes.list_item.createAndFill();
        if (!next) return false;
        const list = schema.nodes.bullet_list.create({}, [item, next]);
        const tr = state.tr.replaceWith(blockStart, blockEnd, list);
        const cursor = blockStart + 1 + item.nodeSize + 2;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    // Ordered list
    const orderedMatch = /^(\d+)\. (.+)$/.exec(text);
    if (
      orderedMatch &&
      schema.nodes.ordered_list &&
      schema.nodes.list_item
    ) {
      if (dispatch) {
        const order = Math.max(1, parseInt(orderedMatch[1], 10));
        const filled = schema.nodes.paragraph.create(
          {},
          schema.text(orderedMatch[2]),
        );
        const item = schema.nodes.list_item.create({}, filled);
        const next = schema.nodes.list_item.createAndFill();
        if (!next) return false;
        const list = schema.nodes.ordered_list.create({ order }, [item, next]);
        const tr = state.tr.replaceWith(blockStart, blockEnd, list);
        const cursor = blockStart + 1 + item.nodeSize + 2;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }

    return false;
  };
}

// Inside a code block, when the caret sits at the end on an empty trailing
// line, Enter exits the fence and lands on a fresh paragraph. Other Enters
// inside the code block fall through to the default (insert literal \n).
export function codeBlockExitOnEmptyLine(schema: Schema): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;
    if ($from.parent.type !== schema.nodes.code_block) return false;

    const text = $from.parent.textContent;
    if ($from.parentOffset !== text.length) return false;
    if (!text.endsWith("\n")) return false;

    const paraType = schema.nodes.paragraph;
    if (!paraType) return false;

    if (dispatch) {
      const tr = state.tr.delete($from.pos - 1, $from.pos);
      const insertAt = tr.mapping.map($from.after());
      const para = paraType.createAndFill();
      if (!para) return false;
      tr.insert(insertAt, para);
      tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
