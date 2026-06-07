import { Plugin } from "prosemirror-state";
import type { Command, EditorState } from "prosemirror-state";

// Font color is a first-class `textColor` mark applied from the right-click
// menu (see ColorMenu.tsx). It is intentionally NOT part of the literal-text
// model, so liveFormat (which only reconciles MANAGED marks) never strips it,
// and the serializer round-trips it as `<span style="color:…">`.

export interface ColorContextDetail {
  x: number;
  y: number;
  /** The color already on the selection, if uniform — to flag the active swatch. */
  current: string | null;
}

// Replace any existing color on the selection with `color`, or clear it when
// `color` is null. No-op on an empty selection (nothing to colour).
export function applyTextColor(color: string | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    const markType = state.schema.marks.textColor;
    if (!markType) return false;
    if (dispatch) {
      const tr = state.tr.removeMark(from, to, markType);
      if (color) tr.addMark(from, to, markType.create({ color }));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

// The color covering the selection, or null if there's none / it's mixed.
export function currentTextColor(state: EditorState): string | null {
  const markType = state.schema.marks.textColor;
  if (!markType) return null;
  const { from, to } = state.selection;
  let color: string | null = null;
  let mixed = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    const m = node.marks.find((mk) => mk.type === markType);
    const c = m ? (m.attrs.color as string) : null;
    if (color === null) color = c;
    else if (color !== c) mixed = true;
  });
  return mixed ? null : color;
}

// Right-click on a non-empty selection opens the color menu (and takes
// precedence over the spell menu, which only fires on a misspelled word). An
// empty selection falls through so spell / native handling still works.
export function buildColorContextPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        contextmenu(view, event) {
          const e = event as MouseEvent;
          if (view.state.selection.empty) return false;
          const detail: ColorContextDetail = {
            x: e.clientX,
            y: e.clientY,
            current: currentTextColor(view.state),
          };
          view.dom.dispatchEvent(
            new CustomEvent<ColorContextDetail>("tylike:color-context", {
              bubbles: true,
              detail,
            }),
          );
          e.preventDefault();
          return true;
        },
      },
    },
  });
}
