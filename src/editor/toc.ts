import { Plugin } from "prosemirror-state";
import type { Node, NodeSpec } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";
import type MarkdownIt from "markdown-it";

// Adım 11 — Table of Contents.
// `[toc]` (or `[TOC]`) on its own line becomes a single atom node. The
// rendered widget lists every heading currently in the doc; a small plugin
// keeps it in sync as headings are added / edited / removed.

export const tocNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  attrs: {},
  parseDOM: [{ tag: "div.toc" }],
  toDOM: () => ["div", { class: "toc" }, "[TOC]"],
};

// markdown-it plugin: replaces a paragraph that consists of just `[toc]`
// (case-insensitive) with a single `toc` token.
export function tocMarkdownItPlugin(md: MarkdownIt) {
  md.core.ruler.after("inline", "toc_replace", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      const open = tokens[i];
      const inline = tokens[i + 1];
      const close = tokens[i + 2];
      if (
        open.type === "paragraph_open" &&
        inline.type === "inline" &&
        close.type === "paragraph_close" &&
        inline.content.trim().toLowerCase() === "[toc]"
      ) {
        const tocToken = new state.Token("toc", "div", 0);
        tocToken.block = true;
        tokens.splice(i, 3, tocToken);
      }
    }
    return true;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTocBody(view: EditorView): string {
  const headings: Array<{ level: number; text: string }> = [];
  view.state.doc.descendants((n) => {
    if (n.type.name === "heading") {
      headings.push({ level: n.attrs.level, text: n.textContent });
    }
  });
  if (headings.length === 0) {
    return '<em class="toc-empty">Henüz başlık yok</em>';
  }
  const items = headings
    .map(
      (h) =>
        `<div class="toc-item toc-h${h.level}">${escapeHtml(h.text)}</div>`,
    )
    .join("");
  return `<div class="toc-title">İçindekiler</div>${items}`;
}

class TocView implements NodeView {
  dom: HTMLElement;

  constructor(_node: Node, view: EditorView) {
    this.dom = document.createElement("div");
    this.dom.className = "toc";
    this.dom.contentEditable = "false";
    this.dom.innerHTML = renderTocBody(view);
  }

  update(node: Node) {
    return node.type.name === "toc";
  }
}

export function buildTocNodeView() {
  return {
    toc: (node: Node, view: EditorView) => new TocView(node, view),
  };
}

// Plugin that watches the doc and re-renders every TOC node when headings
// change. Keeps the toc node itself plain (no content), so we have to find
// each rendered DOM and rewrite its innerHTML directly.
export function buildTocRefreshPlugin(): Plugin {
  return new Plugin({
    view(editorView) {
      let lastDoc = editorView.state.doc;
      return {
        update(view) {
          if (view.state.doc === lastDoc) return;
          lastDoc = view.state.doc;

          // Cheap check: if there are no headings AND no toc nodes, skip.
          let hasToc = false;
          view.state.doc.descendants((n) => {
            if (n.type.name === "toc") hasToc = true;
          });
          if (!hasToc) return;

          const body = renderTocBody(view);
          view.state.doc.descendants((n, pos) => {
            if (n.type.name === "toc") {
              const dom = view.nodeDOM(pos) as HTMLElement | null;
              if (dom) dom.innerHTML = body;
            }
          });
        },
      };
    },
  });
}
