import { convertFileSrc } from "@tauri-apps/api/core";
import type { Node } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

// FAZ 11 — Image NodeView. The default DOM rendering is just <img src>,
// but Tauri's webview can't load file:// URLs directly — they have to go
// through convertFileSrc to become tauri://localhost/... URLs the
// webview is allowed to fetch. Relative paths also have to be resolved
// against the current doc's directory so `foo.assets/bar.png` works the
// way Typora users expect.

const ABSOLUTE_PATH = /^([a-z]:[\\/]|\/)/i;
const URL_LIKE = /^(https?|data|blob|tauri):/i;

function dirOf(filePath: string): string {
  const m = filePath.match(/^(.*)[\\/][^\\/]+$/);
  return m ? m[1] : filePath;
}

export function resolveImageSrc(
  src: string,
  docPath: string | null,
): string {
  if (!src) return src;
  if (URL_LIKE.test(src)) return src;

  let absolute: string;
  if (ABSOLUTE_PATH.test(src)) {
    absolute = src;
  } else if (docPath) {
    absolute = `${dirOf(docPath)}/${src}`;
  } else {
    // No anchor for the relative path — fall back to the raw src and
    // accept that the browser will probably 404 it.
    return src;
  }
  try {
    return convertFileSrc(absolute);
  } catch {
    return absolute;
  }
}

export class ImageView implements NodeView {
  dom: HTMLImageElement;
  private getDocPath: () => string | null;

  constructor(node: Node, getDocPath: () => string | null) {
    this.getDocPath = getDocPath;
    this.dom = document.createElement("img");
    this.dom.className = "doc-image";
    this.dom.addEventListener("error", () => {
      this.dom.classList.add("doc-image-broken");
    });
    this.dom.addEventListener("load", () => {
      this.dom.classList.remove("doc-image-broken");
    });
    this.applyAttrs(node);
  }

  private applyAttrs(node: Node) {
    const src = String(node.attrs.src ?? "");
    this.dom.src = resolveImageSrc(src, this.getDocPath());
    this.dom.alt = String(node.attrs.alt ?? "");
    const title = node.attrs.title;
    if (typeof title === "string" && title) this.dom.title = title;
    else this.dom.removeAttribute("title");
  }

  update(node: Node) {
    if (node.type.name !== "image") return false;
    this.applyAttrs(node);
    return true;
  }
}

export function buildImageNodeView(getDocPath: () => string | null) {
  return {
    image: (node: Node, _view: EditorView) => new ImageView(node, getDocPath),
  };
}
