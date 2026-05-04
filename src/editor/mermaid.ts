import mermaid from "mermaid";
import type { Node } from "prosemirror-model";
import type { NodeView } from "prosemirror-view";

// Adım 9 — Mermaid renderer for ```mermaid fenced code blocks. Other code
// fences fall back to the plain <pre><code> structure.
//
// The view always exposes the source `<code>` as contentDOM (so the
// underlying text is editable inline), and pins a live-rendered SVG preview
// below it for mermaid blocks. Adım 12b will hide the source pane when the
// caret leaves the block to match Typora's source-vs-rendered toggle.

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
  });
}

export class CodeBlockView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private preview: HTMLElement | null = null;
  private isMermaid: boolean;
  private renderToken = 0;

  constructor(node: Node) {
    this.isMermaid = node.attrs.params === "mermaid";

    this.dom = document.createElement("div");
    this.dom.className = this.isMermaid ? "code-block code-mermaid" : "code-block";

    const pre = document.createElement("pre");
    if (node.attrs.params) pre.setAttribute("data-params", node.attrs.params);
    const code = document.createElement("code");
    pre.appendChild(code);
    this.contentDOM = code;
    this.dom.appendChild(pre);

    if (this.isMermaid) {
      ensureInitialized();
      this.preview = document.createElement("div");
      this.preview.className = "mermaid-preview";
      this.preview.contentEditable = "false";
      this.dom.appendChild(this.preview);
      void this.renderPreview(node);
    }
  }

  private async renderPreview(node: Node) {
    if (!this.preview) return;
    const text = node.textContent;
    const target = this.preview;
    const token = ++this.renderToken;

    if (!text.trim()) {
      target.innerHTML = '<em class="mermaid-empty">Mermaid kodu yazın…</em>';
      return;
    }
    try {
      const id = "mermaid-" + Math.random().toString(36).slice(2);
      const { svg } = await mermaid.render(id, text);
      if (token !== this.renderToken) return; // stale
      target.innerHTML = svg;
    } catch (err) {
      if (token !== this.renderToken) return;
      target.textContent =
        "Mermaid hatası: " + (err instanceof Error ? err.message : String(err));
    }
  }

  update(node: Node) {
    if (node.type.name !== "code_block") return false;
    const nextIsMermaid = node.attrs.params === "mermaid";
    if (nextIsMermaid !== this.isMermaid) return false; // recreate
    if (this.isMermaid) {
      void this.renderPreview(node);
    }
    return true;
  }
}
