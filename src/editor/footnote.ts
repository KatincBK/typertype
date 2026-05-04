import type { Node, NodeSpec } from "prosemirror-model";
import type { NodeView } from "prosemirror-view";

// Adım 11 — Footnote nodes.
//   footnote_ref: inline atom showing the back-link in superscript.
//   footnote_def: block containing the footnote body. Visually rendered at
//     the bottom of the document like Typora; the actual layout is just a
//     bordered block with the id badge.

export const footnoteRefSpec: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: { id: { default: "" } },
  parseDOM: [
    {
      tag: "sup.footnote-ref",
      getAttrs: (el) => ({
        id: (el as HTMLElement).getAttribute("data-id") || "",
      }),
    },
  ],
  toDOM: (node) => [
    "sup",
    {
      class: "footnote-ref",
      "data-id": node.attrs.id,
    },
    "[" + node.attrs.id + "]",
  ],
};

export const footnoteDefSpec: NodeSpec = {
  group: "block",
  content: "block+",
  attrs: { id: { default: "" } },
  parseDOM: [
    {
      tag: "div.footnote-def",
      getAttrs: (el) => ({
        id: (el as HTMLElement).getAttribute("data-id") || "",
      }),
    },
  ],
  toDOM: (node) => [
    "div",
    {
      class: "footnote-def",
      "data-id": node.attrs.id,
    },
    0,
  ],
};

class FootnoteRefView implements NodeView {
  dom: HTMLElement;

  constructor(node: Node) {
    this.dom = document.createElement("sup");
    this.dom.className = "footnote-ref";
    this.dom.contentEditable = "false";
    this.dom.setAttribute("data-id", node.attrs.id);
    this.dom.textContent = "[" + node.attrs.id + "]";
    this.dom.title = "Dipnot " + node.attrs.id;
  }

  update(node: Node) {
    if (node.type.name !== "footnote_ref") return false;
    this.dom.setAttribute("data-id", node.attrs.id);
    this.dom.textContent = "[" + node.attrs.id + "]";
    return true;
  }
}

export function buildFootnoteNodeView() {
  return {
    footnote_ref: (node: Node) => new FootnoteRefView(node),
  };
}
