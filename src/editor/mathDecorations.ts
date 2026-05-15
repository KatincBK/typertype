import katex from "katex";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorState } from "prosemirror-state";

// Faz E — Typora-style inline math: the literal `$...$` text lives in the
// doc. This plugin paints it over with a KaTeX rendering when the caret is
// elsewhere, and reveals the raw source when the caret enters the run. A
// click on the rendering drops the caret one step in from the closing `$`.

interface MathRange {
  from: number;
  to: number;
  tex: string;
}

// Same shape as the inline math markdown-it rule: `\\` escapes the next
// char (so `\$` doesn't close), `\$` is allowed via the alternative, and
// neither delimiter may sit against whitespace. `g` so matchAll walks every
// match in a text node. Exported so liveFormat reuses the exact same shape
// to carve math runs out of segments it tries to re-mark.
export const MATH_INLINE_RE =
  /(?<!\\)(?<!\$)\$(?!\s)((?:[^$\\\n]|\\.)+?)(?<!\s)\$(?!\$)/g;

function collectRanges(state: EditorState): MathRange[] {
  const ranges: MathRange[] = [];
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

    MATH_INLINE_RE.lastIndex = 0;
    for (const match of node.text.matchAll(MATH_INLINE_RE)) {
      if (match.index === undefined) continue;
      const from = pos + match.index;
      const to = from + match[0].length;
      ranges.push({ from, to, tex: match[1] });
    }
  });
  return ranges;
}

function buildDecorationSet(state: EditorState): DecorationSet {
  const decos: Decoration[] = [];
  const ranges = collectRanges(state);
  const { from: selFrom, to: selTo } = state.selection;

  for (const r of ranges) {
    // Strict overlap: caret is inside the run when the selection actually
    // crosses any interior position. The literal `$` boundaries themselves
    // count as "outside" so a freshly typed closing `$` immediately renders.
    const isActive = selFrom < r.to && selTo > r.from;

    if (isActive) {
      decos.push(
        Decoration.inline(r.from, r.to, {
          class: "md-math-source md-math-source-active",
        }),
      );
      continue;
    }

    let html: string | null = null;
    let error: string | null = null;
    try {
      html = katex.renderToString(r.tex, {
        throwOnError: true,
        displayMode: false,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    if (html) {
      decos.push(
        Decoration.inline(r.from, r.to, {
          class: "md-math-source md-math-source-hidden",
        }),
      );
      const renderedHtml = html;
      decos.push(
        Decoration.widget(
          r.to,
          (view, getPos) => {
            const span = document.createElement("span");
            span.className = "md-math-rendered";
            span.contentEditable = "false";
            span.innerHTML = renderedHtml;
            span.addEventListener("mousedown", (e) => {
              e.preventDefault();
              const widgetPos = getPos();
              if (typeof widgetPos !== "number") return;
              // Widget sits at the closing `$` — drop the caret one char in
              // so the run becomes active and the source pane appears.
              const caret = Math.max(widgetPos - 1, 0);
              view.dispatch(
                view.state.tr.setSelection(
                  TextSelection.create(view.state.doc, caret),
                ),
              );
              view.focus();
            });
            return span;
          },
          { side: -1, ignoreSelection: true },
        ),
      );
    } else {
      decos.push(
        Decoration.inline(r.from, r.to, {
          class: "md-math-source md-math-source-error",
          title: error ? "Math hatası: " + error : "Math hatası",
        }),
      );
    }
  }

  return DecorationSet.create(state.doc, decos);
}

export const mathDecorationsKey = new PluginKey<DecorationSet>("mathDecorations");

export function buildMathDecorationsPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: mathDecorationsKey,
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
        return mathDecorationsKey.getState(state);
      },
    },
  });
}
