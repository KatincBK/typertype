import katex from "katex";
import type { Node, NodeSpec } from "prosemirror-model";
import type { NodeView } from "prosemirror-view";
import type MarkdownIt from "markdown-it";

// Adım 8 — KaTeX math.
//
// math_inline is no longer a node — the literal `$...$` text lives in the
// document and `mathDecorations` renders it (Typora-style source reveal).
// Only math_block stays as a real node here: its `$$...$$` source is editable
// inline as text content, with the KaTeX preview pinned alongside.

export const mathBlockSpec: NodeSpec = {
  group: "block",
  content: "text*",
  code: true,
  defining: true,
  marks: "",
  attrs: {},
  parseDOM: [{ tag: "div.math-block", preserveWhitespace: "full" }],
  toDOM: () => ["div", { class: "math-block" }, ["pre", 0]],
};

// markdown-it plugin: inline `$...$` math. Used ONLY by the HTML export
// renderer (`md` in serializer.ts). The editor-parse path skips this so the
// raw `$...$` text reaches the doc, where mathDecorations renders it
// Typora-style with a cursor-gated source reveal.
export function mathInlineMarkdownItPlugin(md: MarkdownIt) {
  md.inline.ruler.after("escape", "math_inline", (state, silent) => {
    const src = state.src;
    if (src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
    if (src.charCodeAt(state.pos + 1) === 0x24) return false; // $$ → block

    let pos = state.pos + 1;
    while (pos < state.posMax) {
      const ch = src.charCodeAt(pos);
      if (ch === 0x0a /* \n */) return false;
      if (ch === 0x24 /* $ */ && src.charCodeAt(pos - 1) !== 0x5c /* \ */) {
        break;
      }
      pos++;
    }

    if (pos >= state.posMax) return false;
    if (pos === state.pos + 1) return false;

    const content = src.slice(state.pos + 1, pos);
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = content;
      token.markup = "$";
    }
    state.pos = pos + 1;
    return true;
  });
}

// markdown-it plugin: emits `math_block` tokens for fenced `$$...$$` blocks.
// Used by BOTH the editor-parse path and the HTML export renderer.
export function mathMarkdownItPlugin(md: MarkdownIt) {
  md.block.ruler.after("blockquote", "math_block", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (start + 2 > max) return false;
    if (state.src.slice(start, start + 2) !== "$$") return false;

    const firstRest = state.src.slice(start + 2, max).replace(/\s+$/, "");

    let content: string;
    let lastLine: number;

    if (firstRest.endsWith("$$") && firstRest.length >= 2) {
      content = firstRest.slice(0, -2).trim();
      lastLine = startLine;
    } else {
      let i = startLine + 1;
      let found = false;
      while (i < endLine) {
        const ls = state.bMarks[i] + state.tShift[i];
        const le = state.eMarks[i];
        if (state.src.slice(ls, le).trim() === "$$") {
          found = true;
          break;
        }
        i++;
      }
      if (!found) return false;

      const parts: string[] = [];
      if (firstRest) parts.push(firstRest);
      for (let j = startLine + 1; j < i; j++) {
        const ls = state.bMarks[j] + state.tShift[j];
        const le = state.eMarks[j];
        parts.push(state.src.slice(ls, le));
      }
      content = parts.join("\n").trim();
      lastLine = i;
    }

    if (silent) return true;

    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.markup = "$$";
    token.content = content;
    token.map = [startLine, lastLine + 1];
    state.line = lastLine + 1;
    return true;
  });
}

class MathBlockView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private preview: HTMLElement;

  constructor(node: Node) {
    this.dom = document.createElement("div");
    this.dom.className = "math-block";

    const source = document.createElement("pre");
    source.className = "math-block-source";
    const code = document.createElement("code");
    source.appendChild(code);
    this.contentDOM = code;

    this.preview = document.createElement("div");
    this.preview.className = "math-block-preview";
    this.preview.contentEditable = "false";

    this.dom.appendChild(source);
    this.dom.appendChild(this.preview);

    this.render(node);
  }

  private render(node: Node) {
    const tex = node.textContent;
    if (!tex.trim()) {
      this.preview.innerHTML = '<em class="math-empty">LaTeX yazın…</em>';
      return;
    }
    try {
      katex.render(tex, this.preview, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (err) {
      this.preview.textContent =
        "Math hatası: " + (err instanceof Error ? err.message : String(err));
    }
  }

  update(node: Node) {
    if (node.type.name !== "math_block") return false;
    this.render(node);
    return true;
  }
}

export function buildMathNodeViews() {
  return {
    math_block: (node: Node) => new MathBlockView(node),
  };
}
