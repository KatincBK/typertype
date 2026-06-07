import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import i18n from "@/lib/i18n";

// Notion-style drag handle for list items. A ⠿ grip appears to the left of
// each list item on hover; dragging it reorders the item among its siblings
// in the SAME list. Other block types are intentionally out of scope — only
// list items get a handle (user decision: "sadece liste maddeleri").
//
// The drag SOURCE is tracked in a plugin-local ref, not in plugin state, so
// `dragstart` never dispatches a transaction. Dispatching there mutates the
// dragged element's DOM (the dim decoration) and Chromium responds by
// cancelling the native drag — which made the item grabbable but impossible to
// drop anywhere. Only the drop indicator lives in plugin state, updated on
// `dragover` where a dispatch is safe because the drag is already live.

export const listDragKey = new PluginKey<ListDragState>("listDrag");

type DropTarget = { pos: number; side: "before" | "after" };

interface ListDragState {
  handles: DecorationSet;
  dropTarget: DropTarget | null;
  /** Source item position, mirrored into state so the dim deco can render. */
  source: number | null;
}

// Build the move transaction. Exported for unit testing: given the source
// list_item position and a drop target, returns a tr that removes the item and
// reinserts it at the target slot, or null when the move would be a no-op /
// invalid.
export function moveListItem(
  state: EditorState,
  sourcePos: number,
  target: DropTarget,
): Transaction | null {
  const itemNode = state.doc.nodeAt(sourcePos);
  if (!itemNode || itemNode.type.name !== "list_item") return null;
  const targetNode = state.doc.nodeAt(target.pos);
  if (!targetNode || targetNode.type.name !== "list_item") return null;

  const from = sourcePos;
  const to = sourcePos + itemNode.nodeSize;
  const insertPos =
    target.side === "before" ? target.pos : target.pos + targetNode.nodeSize;

  // Dropping into the slot the item already occupies is a no-op.
  if (insertPos >= from && insertPos <= to) return null;

  let tr = state.tr.delete(from, to);
  const mapped = tr.mapping.map(insertPos);
  tr = tr.insert(mapped, itemNode);
  return tr.scrollIntoView();
}

// Resolve the pointer position to a drop target: the sibling list_item under
// the cursor, with before/after chosen by the item's vertical midpoint. Drops
// are constrained to the dragged item's own list.
function dropTargetFromEvent(
  view: EditorView,
  event: DragEvent,
  draggingPos: number,
): DropTarget | null {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return null;
  const $pos = view.state.doc.resolve(coords.pos);
  const draggedParent = view.state.doc.resolve(draggingPos).before();

  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "list_item") {
      const itemPos = $pos.before(d);
      if (view.state.doc.resolve(itemPos).before() !== draggedParent) return null;
      const dom = view.nodeDOM(itemPos);
      let side: "before" | "after" = "after";
      if (dom instanceof HTMLElement) {
        const rect = dom.getBoundingClientRect();
        side = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      }
      return { pos: itemPos, side };
    }
  }
  return null;
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.pos === b.pos && a.side === b.side;
}

export function buildListDragPlugin(): Plugin<ListDragState> {
  // Live drag source position (before the dragged list_item), or null. Held
  // outside plugin state precisely so dragstart can stay dispatch-free.
  let dragSource: number | null = null;

  const renderHandle = (view: EditorView, getPos: () => number | undefined) => {
    const dom = document.createElement("span");
    dom.className = "list-drag-handle";
    dom.setAttribute("contenteditable", "false");
    dom.setAttribute("draggable", "true");
    dom.setAttribute("aria-hidden", "true");
    dom.title = i18n.t("editor.dragHandleTitle");
    dom.textContent = "⠿"; // ⠿

    // Stop PM from moving the caret / selecting when the grip is grabbed, but
    // leave the native drag intact (don't preventDefault on mousedown).
    dom.addEventListener("mousedown", (e) => e.stopPropagation());

    dom.addEventListener("dragstart", (e) => {
      const widgetPos = getPos();
      if (widgetPos == null) return;
      dragSource = widgetPos - 1; // position before the list_item node
      e.stopPropagation(); // don't let PM's own dragstart claim this
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag without data on the transfer.
        e.dataTransfer.setData("text/plain", "");
      }
      // NB: deliberately no view.dispatch here — see file header.
    });

    dom.addEventListener("dragend", () => {
      dragSource = null;
      if (listDragKey.getState(view.state)?.dropTarget != null) {
        view.dispatch(view.state.tr.setMeta(listDragKey, { type: "end" }));
      }
    });

    return dom;
  };

  const buildHandleDecos = (doc: PMNode): Decoration[] => {
    const decos: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === "list_item") {
        decos.push(Decoration.widget(pos + 1, renderHandle, { side: -1 }));
      }
      return true;
    });
    return decos;
  };

  return new Plugin<ListDragState>({
    key: listDragKey,
    state: {
      init(_config, instance) {
        return {
          handles: DecorationSet.create(instance.doc, buildHandleDecos(instance.doc)),
          dropTarget: null,
          source: null,
        };
      },
      apply(tr, prev) {
        let { handles, dropTarget, source } = prev;
        if (tr.docChanged) {
          // Rebuild handles for the new doc; any in-flight drag is cancelled.
          handles = DecorationSet.create(tr.doc, buildHandleDecos(tr.doc));
          dropTarget = null;
          source = null;
        }
        const meta = tr.getMeta(listDragKey) as
          | { type: "over"; target: DropTarget | null; source: number | null }
          | { type: "end" }
          | undefined;
        if (meta) {
          if (meta.type === "over") {
            dropTarget = meta.target;
            source = meta.source;
          } else {
            dropTarget = null;
            source = null;
          }
        }
        return { handles, dropTarget, source };
      },
    },
    props: {
      decorations(state) {
        const ps = listDragKey.getState(state);
        if (!ps) return null;
        const extra: Decoration[] = [];
        if (ps.source != null) {
          const node = state.doc.nodeAt(ps.source);
          if (node) {
            extra.push(
              Decoration.node(ps.source, ps.source + node.nodeSize, {
                class: "list-item-dragging",
              }),
            );
          }
        }
        if (ps.dropTarget) {
          const targetNode = state.doc.nodeAt(ps.dropTarget.pos);
          if (targetNode) {
            const at =
              ps.dropTarget.side === "before"
                ? ps.dropTarget.pos
                : ps.dropTarget.pos + targetNode.nodeSize;
            extra.push(
              Decoration.widget(
                at,
                () => {
                  const d = document.createElement("div");
                  d.className = "list-drop-indicator";
                  return d;
                },
                { side: -1 },
              ),
            );
          }
        }
        return extra.length ? ps.handles.add(state.doc, extra) : ps.handles;
      },
      handleDOMEvents: {
        dragover(view, event) {
          if (dragSource == null) return false;
          const target = dropTargetFromEvent(view, event, dragSource);
          if (target) {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          }
          const ps = listDragKey.getState(view.state);
          if (ps && !sameTarget(ps.dropTarget, target)) {
            view.dispatch(
              view.state.tr.setMeta(listDragKey, {
                type: "over",
                target,
                source: dragSource,
              }),
            );
          }
          return false;
        },
        drop(view, event) {
          if (dragSource == null) return false;
          event.preventDefault();
          const ps = listDragKey.getState(view.state);
          const target =
            ps?.dropTarget ?? dropTargetFromEvent(view, event, dragSource);
          const src = dragSource;
          dragSource = null;
          if (target) {
            const tr = moveListItem(view.state, src, target);
            if (tr) {
              tr.setMeta(listDragKey, { type: "end" });
              view.dispatch(tr);
              return true;
            }
          }
          view.dispatch(view.state.tr.setMeta(listDragKey, { type: "end" }));
          return true;
        },
        dragend(view) {
          dragSource = null;
          if (listDragKey.getState(view.state)?.dropTarget != null) {
            view.dispatch(view.state.tr.setMeta(listDragKey, { type: "end" }));
          }
          return false;
        },
      },
    },
  });
}
