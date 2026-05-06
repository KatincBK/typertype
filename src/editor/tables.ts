import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  tableEditing,
  tableNodes,
} from "prosemirror-tables";
import { Plugin } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Node, Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

// Adım 10 — GFM tables via prosemirror-tables.
// `tableNodeSpecs` is destructured back to individual NodeSpecs so they can
// be appended to the schema's OrderedMap one-by-one.

const tableNodeSpecs = tableNodes({
  tableGroup: "block",
  cellContent: "block+",
  cellAttributes: {
    align: {
      default: null,
      getFromDOM: (dom: HTMLElement) => dom.style.textAlign || null,
      setDOMAttr: (value: unknown, attrs: Record<string, unknown>) => {
        if (typeof value === "string" && value) {
          const existing = typeof attrs.style === "string" ? attrs.style : "";
          attrs.style = existing + `text-align: ${value};`;
        }
      },
    },
  },
});

export const tableNodeSpecMap = tableNodeSpecs;

export function buildTablePlugins(): Plugin[] {
  return [columnResizing(), tableEditing()];
}

// Insert a 3-column × 2-row table at the caret. Header row first, body row
// second — same starting layout Typora uses for Ctrl+T.
export const insertTable =
  (schema: Schema): Command =>
  (state, dispatch) => {
    const tableType = schema.nodes.table;
    const rowType = schema.nodes.table_row;
    const headerType = schema.nodes.table_header;
    const cellType = schema.nodes.table_cell;
    const paragraph = schema.nodes.paragraph;
    if (!tableType || !rowType || !headerType || !cellType || !paragraph) {
      return false;
    }
    if (dispatch) {
      const filled = paragraph.createAndFill();
      if (!filled) return false;
      // ProseMirror nodes are immutable so the same `filled` paragraph can
      // safely back every cell — editing one cell creates a new doc with
      // only that cell's content replaced.
      const headerCell = headerType.create(null, filled);
      const bodyCell = cellType.create(null, filled);
      const headerRow = rowType.create(null, [headerCell, headerCell, headerCell]);
      const bodyRow = rowType.create(null, [bodyCell, bodyCell, bodyCell]);
      const table = tableType.create(null, [headerRow, bodyRow]);
      dispatch(state.tr.replaceSelectionWith(table).scrollIntoView());
    }
    return true;
  };

export const tableKeyboardCommands = {
  goToNextCell: goToNextCell(1),
  goToPrevCell: goToNextCell(-1),
};

// Floating toolbar shown above the table that contains the caret. Each
// button dispatches a prosemirror-tables command. The toolbar lives in the
// document body so it can hover above the editor without affecting layout.
class TableToolbarView {
  private toolbar: HTMLElement;
  private editorView: EditorView;

  constructor(view: EditorView) {
    this.editorView = view;
    this.toolbar = document.createElement("div");
    this.toolbar.className = "table-toolbar";
    this.toolbar.style.display = "none";
    this.attachButtons();
    document.body.appendChild(this.toolbar);
    this.update(view);
  }

  private attachButtons() {
    const make = (label: string, title: string, run: Command) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "table-toolbar-btn";
      btn.title = title;
      btn.textContent = label;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        run(this.editorView.state, this.editorView.dispatch);
        this.editorView.focus();
      });
      this.toolbar.appendChild(btn);
    };
    make("← Sütun", "Soluna sütun ekle", addColumnBefore);
    make("Sütun →", "Sağına sütun ekle", addColumnAfter);
    make("✕ Sütun", "Sütunu sil", deleteColumn);
    make("↑ Satır", "Üstüne satır ekle", addRowBefore);
    make("Satır ↓", "Altına satır ekle", addRowAfter);
    make("✕ Satır", "Satırı sil", deleteRow);
    make("✕ Tablo", "Tabloyu sil", deleteTable);
  }

  update(view: EditorView) {
    const { selection } = view.state;
    const $head = selection.$head;
    let tableDepth = -1;
    for (let d = $head.depth; d > 0; d--) {
      if ($head.node(d).type.name === "table") {
        tableDepth = d;
        break;
      }
    }
    if (tableDepth < 0) {
      this.toolbar.style.display = "none";
      return;
    }

    let coords;
    try {
      coords = view.coordsAtPos($head.before(tableDepth));
    } catch {
      this.toolbar.style.display = "none";
      return;
    }
    this.toolbar.style.display = "flex";
    this.toolbar.style.position = "fixed";
    this.toolbar.style.left = coords.left + "px";
    this.toolbar.style.top = Math.max(0, coords.top - 36) + "px";
  }

  destroy() {
    this.toolbar.remove();
  }
}

export function buildTableToolbarPlugin(): Plugin {
  return new Plugin({
    view(editorView) {
      return new TableToolbarView(editorView);
    },
  });
}

// Helper for the markdown serializer to emit a GFM table. Mirrors the
// rendering of `defaultMarkdownSerializer.nodes.table` (which doesn't
// exist) by reading the prosemirror-tables shape directly. We borrow
// the host MarkdownSerializerState so each cell goes through the same
// mark / escape rules as the rest of the doc — using cell.textContent
// here would silently drop bold/italic/code/link inside cells.
import type { MarkdownSerializerState } from "prosemirror-markdown";

export function serializeTable(
  node: Node,
  state: MarkdownSerializerState,
): string {
  const rows: string[][] = [];
  const aligns: Array<string | null> = [];

  // state.out is the running buffer the serializer writes into. The
  // public typings hide this field (it's marked internal) but the
  // class exposes it at runtime — every prosemirror-markdown table
  // helper in the wild reaches for it the same way. We capture its
  // length, let renderInline append the cell's inline markdown, then
  // slice off the appended fragment and truncate the buffer back so
  // the table prelude doesn't leak any cell text into the doc.
  const stateOut = state as unknown as { out: string };
  const renderInline = (cell: Node): string => {
    const para = cell.firstChild;
    if (!para || !para.isTextblock) return "";
    const before = stateOut.out.length;
    state.renderInline(para);
    const rendered = stateOut.out.slice(before);
    stateOut.out = stateOut.out.slice(0, before);
    return rendered;
  };

  node.forEach((row, _rowOffset, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, _cellOffset, cellIndex) => {
      const raw = renderInline(cell);
      const cellText =
        raw.replace(/\|/g, "\\|").replace(/\n/g, " ").trim() || " ";
      cells.push(cellText);
      if (rowIndex === 0) {
        aligns[cellIndex] = (cell.attrs as { align?: string }).align ?? null;
      }
    });
    rows.push(cells);
  });

  if (rows.length === 0) return "";

  const headerRow = rows[0];
  const sep = aligns.map((a) => {
    if (a === "left") return ":---";
    if (a === "right") return "---:";
    if (a === "center") return ":---:";
    return "---";
  });
  while (sep.length < headerRow.length) sep.push("---");

  const lines = [
    "| " + headerRow.join(" | ") + " |",
    "| " + sep.join(" | ") + " |",
    ...rows.slice(1).map((r) => "| " + r.join(" | ") + " |"),
  ];
  return lines.join("\n");
}
