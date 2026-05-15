import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorState } from "prosemirror-state";
import { EMOJI_INDEX } from "./emoji";

// Faz F — Typora-style emoji: the literal `:shortcode:` text lives in the
// doc. This plugin paints the unicode glyph over it when the caret is
// elsewhere, and reveals the raw source when the caret enters the run.
// Mirrors mathDecorations; the only differences are no error state (an
// unknown shortcode just gets no decoration) and the rendered widget is a
// single glyph instead of a KaTeX HTML fragment.

interface EmojiRange {
  from: number;
  to: number;
  char: string;
  shortcode: string;
}

export const EMOJI_INLINE_RE = /:([a-z0-9_+-]+):/gi;

function collectRanges(state: EditorState): EmojiRange[] {
  const ranges: EmojiRange[] = [];
  state.doc.descendants((node, pos, parent) => {
    if (
      parent &&
      (parent.type.name === "code_block" || parent.type.name === "math_block")
    ) {
      return false;
    }
    if (node.type.name === "code_block" || node.type.name === "math_block") {
      return false;
    }
    if (!node.isText || !node.text) return;
    if (node.marks.some((m) => m.type.name === "code")) return;

    EMOJI_INLINE_RE.lastIndex = 0;
    for (const match of node.text.matchAll(EMOJI_INLINE_RE)) {
      if (match.index === undefined) continue;
      const entry = EMOJI_INDEX.get(match[1].toLowerCase());
      if (!entry) continue; // unknown shortcode — leave it as plain text
      ranges.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        char: entry.char,
        shortcode: entry.shortcode,
      });
    }
  });
  return ranges;
}

function buildDecorationSet(state: EditorState): DecorationSet {
  const decos: Decoration[] = [];
  const ranges = collectRanges(state);
  const { from: selFrom, to: selTo } = state.selection;

  for (const r of ranges) {
    const isActive = selFrom < r.to && selTo > r.from;

    if (isActive) {
      decos.push(
        Decoration.inline(r.from, r.to, {
          class: "md-emoji-source md-emoji-source-active",
        }),
      );
      continue;
    }

    decos.push(
      Decoration.inline(r.from, r.to, {
        class: "md-emoji-source md-emoji-source-hidden",
      }),
    );
    const char = r.char;
    const shortcode = r.shortcode;
    decos.push(
      Decoration.widget(
        r.to,
        () => {
          const span = document.createElement("span");
          span.className = "md-emoji-rendered";
          span.contentEditable = "false";
          span.title = ":" + shortcode + ":";
          span.textContent = char;
          return span;
        },
        { side: -1, ignoreSelection: true },
      ),
    );
  }

  return DecorationSet.create(state.doc, decos);
}

export const emojiDecorationsKey = new PluginKey<DecorationSet>("emojiDecorations");

export function buildEmojiDecorationsPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: emojiDecorationsKey,
    state: {
      init(_, state) {
        return buildDecorationSet(state);
      },
      apply(tr, value, oldState, newState) {
        if (
          !tr.docChanged &&
          oldState.selection.eq(newState.selection)
        ) {
          return value;
        }
        return buildDecorationSet(newState);
      },
    },
    props: {
      decorations(state) {
        return emojiDecorationsKey.getState(state);
      },
      // Click on the rendered glyph → drop the caret one step in from the
      // closing `:` so the run becomes active and the source reveals.
      // Same rationale as mathDecorations: handling this at the plugin
      // level avoids fighting ProseMirror's default click handling on
      // contentEditable=false widgets.
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement | null;
        if (!target?.closest?.(".md-emoji-rendered")) return false;
        const ranges = collectRanges(view.state);
        for (const r of ranges) {
          if (pos < r.from || pos > r.to) continue;
          const caret = Math.max(r.to - 1, r.from + 1);
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.create(view.state.doc, caret),
            ),
          );
          return true;
        }
        return false;
      },
    },
  });
}
