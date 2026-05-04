import katex from "katex";
import { Plugin } from "prosemirror-state";
import type { Node, NodeSpec, Schema } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";
import type MarkdownIt from "markdown-it";

// Adım 8 — KaTeX math.
//
// Two node types:
//   math_inline: atom node (no editable content). Holds LaTeX in `tex` attr;
//     click pops a prompt to edit. Fits Typora's inline-math feel.
//   math_block:  text-content block (like code_block). The source pre is
//     editable in place; a KaTeX preview renders alongside on every change.
//     Adım 12b will refine this into a proper source-vs-rendered toggle.

export const mathInlineSpec: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: { tex: { default: "" } },
  parseDOM: [
    {
      tag: "span.math-inline",
      getAttrs: (el) => ({
        tex: (el as HTMLElement).getAttribute("data-tex") || "",
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    { class: "math-inline", "data-tex": node.attrs.tex },
    "$" + node.attrs.tex + "$",
  ],
};

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

// markdown-it plugin: emits `math_inline` and `math_block` tokens with the
// LaTeX in `.content`. We don't ship an HTML renderer here — the prosemirror
// markdown parser maps these tokens onto the schema nodes.
export function mathMarkdownItPlugin(md: MarkdownIt) {
  // Inline: $...$
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

  // Block: $$ ... $$
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

class MathInlineView implements NodeView {
  dom: HTMLElement;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.dom = document.createElement("span");
    this.dom.className = "math-inline";
    this.dom.contentEditable = "false";
    this.render(node);

    this.dom.addEventListener("click", (e) => {
      e.preventDefault();
      const pos = getPos();
      if (typeof pos !== "number") return;
      const next = window.prompt("LaTeX (inline):", node.attrs.tex);
      if (next == null) return;
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { tex: next }));
    });
  }

  private render(node: Node) {
    const tex = node.attrs.tex || "";
    if (!tex) {
      this.dom.textContent = "$$";
      return;
    }
    try {
      katex.render(tex, this.dom, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      this.dom.textContent = "$" + tex + "$";
    }
  }

  update(node: Node) {
    if (node.type.name !== "math_inline") return false;
    this.render(node);
    return true;
  }

  ignoreMutation() {
    return true;
  }

  stopEvent() {
    return false;
  }
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
    math_inline: (node: Node, view: EditorView, getPos: () => number | undefined) =>
      new MathInlineView(node, view, getPos),
    math_block: (node: Node) => new MathBlockView(node),
  };
}

// Detect $...$ in plain text and convert to math_inline atoms. Must run
// *before* live-format so the math contents (which often contain ^ _ etc.)
// don't get partially marked as superscript / subscript first.
export function buildLiveMathPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (transactions.some((tr) => tr.getMeta("liveMath") === true)) return null;

      const mathInline = schema.nodes.math_inline;
      if (!mathInline) return null;

      const replacements: { from: number; to: number; tex: string }[] = [];

      newState.doc.descendants((node, pos) => {
        if (node.type.name === "code_block" || node.type.name === "math_block") {
          return false; // skip children of code-like blocks entirely
        }
        if (!node.isText || !node.text) return;
        if (node.marks.some((m) => m.type.name === "code")) return;

        const re = /(?<!\\)(?<!\$)\$(\S[^$\n]*?\S|\S)\$(?!\$)/g;
        for (const match of node.text.matchAll(re)) {
          if (match.index === undefined) continue;
          replacements.push({
            from: pos + match.index,
            to: pos + match.index + match[0].length,
            tex: match[1],
          });
        }
      });

      if (replacements.length === 0) return null;

      replacements.sort((a, b) => b.from - a.from);

      const tr = newState.tr;
      tr.setMeta("liveMath", true);
      for (const r of replacements) {
        tr.replaceWith(r.from, r.to, mathInline.create({ tex: r.tex }));
      }
      return tr;
    },
  });
}
