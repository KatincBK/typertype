import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import i18n from "@/lib/i18n";

// Notion-style drag handle for list items. A ⠿ grip appears to the left of
// each list item on hover; dragging it reorders the item among its siblings in
// the SAME list. Other block types are intentionally out of scope (user
// decision: "sadece liste maddeleri").
//
// The reorder runs on POINTER events (mousedown on the grip → mousemove →
// mouseup), NOT the native HTML5 drag-and-drop API. Native drag inside a
// contentEditable host fights ProseMirror's own drag handling and the browser
// kept showing a "not-allowed" cursor and refusing the drop. Driving it with
// plain mouse events lets us own the cursor (CSS `body.list-dragging`), the
// drop indicator, and the final move transaction with no browser arbitration.

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

// Resolve a pointer position to a drop target purely from its VERTICAL position
// (clientY) — clientX is ignored on purpose so a drag straight down the left
// margin (where the grip lives) still lands, instead of only registering over
// the thin strip of text. We scan the dragged item's own sibling list_items and
// pick the one whose rect is nearest clientY, with before/after by its midpoint.
// Scanning only same-list siblings keeps drops constrained to that list, and
// clamps naturally to the first / last item above-all / below-all.
function dropTargetByY(
  view: EditorView,
  clientY: number,
  draggingPos: number,
): DropTarget | null {
  const $dragged = view.state.doc.resolve(draggingPos);
  const listNode = $dragged.parent;
  const contentStart = $dragged.start();

  let best: DropTarget | null = null;
  let bestDist = Infinity;
  listNode.forEach((child, offset) => {
    if (child.type.name !== "list_item") return;
    const itemPos = contentStart + offset;
    const dom = view.nodeDOM(itemPos);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    const dist =
      clientY < rect.top
        ? rect.top - clientY
        : clientY > rect.bottom
          ? clientY - rect.bottom
          : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = {
        pos: itemPos,
        side: clientY < rect.top + rect.height / 2 ? "before" : "after",
      };
    }
  });
  return best;
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.pos === b.pos && a.side === b.side;
}

export function buildListDragPlugin(): Plugin<ListDragState> {
  // Live drag state, held in the plugin closure (not plugin state) so the grip
  // mousedown handler and the document-level move/up handlers share it without
  // round-tripping through transactions.
  let activeView: EditorView | null = null;
  let dragging: number | null = null; // source list_item position, or null
  let lastTarget: DropTarget | null = null;

  const cleanupListeners = () => {
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("mouseup", onMouseUp, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.body.classList.remove("list-dragging");
  };

  const onMouseMove = (e: MouseEvent) => {
    if (dragging == null || !activeView) return;
    const target = dropTargetByY(activeView, e.clientY, dragging);
    if (!sameTarget(lastTarget, target)) {
      lastTarget = target;
      activeView.dispatch(
        activeView.state.tr.setMeta(listDragKey, {
          type: "over",
          target,
          source: dragging,
        }),
      );
    }
  };

  const endDrag = (commit: boolean) => {
    const view = activeView;
    const src = dragging;
    const target = lastTarget;
    cleanupListeners();
    activeView = null;
    dragging = null;
    lastTarget = null;
    if (!view) return;
    if (commit && src != null && target) {
      const tr = moveListItem(view.state, src, target);
      if (tr) {
        tr.setMeta(listDragKey, { type: "end" });
        view.dispatch(tr);
        return;
      }
    }
    view.dispatch(view.state.tr.setMeta(listDragKey, { type: "end" }));
  };

  const onMouseUp = () => endDrag(true);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      endDrag(false); // cancel — leave the list as it was
    }
  };

  const startDrag = (view: EditorView, itemPos: number) => {
    activeView = view;
    dragging = itemPos;
    lastTarget = null;
    document.body.classList.add("list-dragging");
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("keydown", onKeyDown, true);
    // Dim the grabbed item right away (safe: pointer-driven, so unlike the old
    // native-drag handler this dispatch can't cancel a browser drag).
    view.dispatch(
      view.state.tr.setMeta(listDragKey, {
        type: "over",
        target: null,
        source: itemPos,
      }),
    );
  };

  const renderHandle = (view: EditorView, getPos: () => number | undefined) => {
    const dom = document.createElement("span");
    dom.className = "list-drag-handle";
    dom.setAttribute("contenteditable", "false");
    dom.setAttribute("aria-hidden", "true");
    dom.title = i18n.t("editor.dragHandleTitle");
    dom.textContent = "⠿"; // ⠿

    dom.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const widgetPos = getPos();
      if (widgetPos == null) return;
      // Prevent the caret from moving / text from being selected, and keep
      // ProseMirror's own mousedown handling from firing for the grip.
      e.preventDefault();
      e.stopPropagation();
      startDrag(view, widgetPos - 1); // position before the list_item node
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
    },
    view() {
      return {
        destroy() {
          // Tear down any drag still in progress when the editor unmounts.
          if (dragging != null) endDrag(false);
          cleanupListeners();
        },
      };
    },
  });
}
