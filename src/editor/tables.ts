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
      setDOMAttr: (value: string | null, attrs: Record<string, string>) => {
        if (value) {
          attrs.style = (attrs.style || "") + `text-align: ${value};`;
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
      const empty = paragraph.createAndFill();
      if (!empty) return false;
      const headerCell = headerType.create(null, paragraph.createAndFill()!);
      const bodyCell = cellType.create(null, paragraph.createAndFill()!);
      const headerRow = rowType.create(null, [headerCell, headerCell, headerCell]);
      const bodyRow = rowType.create(null, [bodyCell, bodyCell, bodyCell]);
      const table = tableType.create(null, [headerRow, bodyRow]);
      const tr = state.tr.replaceSelectionWith(table).scrollIntoView();
      dispatch(tr);
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
// exist) by reading the prosemirror-tables shape directly.
export function serializeTable(node: Node): string {
  const rows: string[][] = [];
  const aligns: Array<string | null> = [];

  node.forEach((row, _rowOffset, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, _cellOffset, cellIndex) => {
      const cellText = cell.textContent.replace(/\|/g, "\\|").trim() || " ";
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
