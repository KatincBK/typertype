import { convertFileSrc } from "@tauri-apps/api/core";
import type { Node } from "prosemirror-model";
import { NodeSelection } from "prosemirror-state";
import type {
  EditorView,
  NodeView,
  ViewMutationRecord,
} from "prosemirror-view";
import i18n from "@/lib/i18n";

// FAZ 11 follow-up — ImageView grew from a bare <img> NodeView into a
// wrapper that owns selection, resize, alignment and dialog hooks. The
// outer span is contenteditable so ProseMirror still treats the image
// as inline content, but `.image-controls` is contenteditable=false so
// clicks on handles / popover buttons don't move the editor selection.
//
// Resize / alignment are stored as ProseMirror node attrs and round-trip
// through serializer.ts as raw <img> tags. Alt-edit and lightbox emit
// custom DOM events bubbled to App.tsx, which mounts the actual modal /
// overlay React components.

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
    return src;
  }
  try {
    return convertFileSrc(absolute);
  } catch {
    return absolute;
  }
}

export interface ImageAltEditDetail {
  alt: string;
  title: string;
  commit: (alt: string, title: string) => void;
}

export interface ImageLightboxDetail {
  src: string;
  alt: string;
}

type Align = "left" | "center" | "right" | null;

export class ImageView implements NodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private controls: HTMLElement;
  private widthLabel: HTMLElement;
  private node: Node;
  private view: EditorView;
  private getPos: () => number | undefined;
  private getDocPath: () => string | null;
  private resizing = false;
  private pendingWidth: string | null = null;
  // Buttons with translated titles + resize handle — kept so a language
  // flip can rewrite their `title` attributes in place.
  private localizedTitles: Array<{ el: HTMLElement; key: string }> = [];
  private onLanguageChanged = () => this.relabel();

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
    getDocPath: () => string | null,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.getDocPath = getDocPath;

    this.dom = document.createElement("span");
    this.dom.className = "image-wrapper";

    this.img = document.createElement("img");
    this.img.className = "doc-image";
    this.img.draggable = false;
    this.img.addEventListener("error", () => {
      this.dom.classList.add("doc-image-broken");
    });
    this.img.addEventListener("load", () => {
      this.dom.classList.remove("doc-image-broken");
    });
    this.img.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openAltDialog();
    });
    this.dom.appendChild(this.img);

    // Controls live in a contenteditable=false sibling so the editor
    // can't accidentally route keystrokes / selection into them.
    this.controls = document.createElement("span");
    this.controls.className = "image-controls";
    this.controls.contentEditable = "false";
    this.controls.addEventListener("mousedown", (e) => {
      // Don't let mousedowns on the toolbar collapse the NodeSelection
      // — those clicks are for buttons, not for moving the cursor.
      e.preventDefault();
    });

    const popover = document.createElement("span");
    popover.className = "image-popover";

    // Vanilla DOM ⇒ no useTranslation hook; pull labels from the i18n
    // singleton at construction and subscribe to `languageChanged` so
    // existing popovers relabel without needing a remount.
    popover.appendChild(
      this.makeBtn("⯇", "image.popover.alignLeft", () =>
        this.setAlign("left"),
      ),
    );
    popover.appendChild(
      this.makeBtn("◉", "image.popover.alignCenter", () =>
        this.setAlign("center"),
      ),
    );
    popover.appendChild(
      this.makeBtn("⯈", "image.popover.alignRight", () =>
        this.setAlign("right"),
      ),
    );
    popover.appendChild(
      this.makeBtn("⌫", "image.popover.alignClear", () =>
        this.setAlign(null),
      ),
    );
    const sep = document.createElement("span");
    sep.className = "image-popover-sep";
    popover.appendChild(sep);
    popover.appendChild(
      this.makeBtn("Aa", "image.popover.editAlt", () =>
        this.openAltDialog(),
      ),
    );
    popover.appendChild(
      this.makeBtn("⛶", "image.popover.fullscreen", () =>
        this.openLightbox(),
      ),
    );
    popover.appendChild(
      this.makeBtn("100%", "image.popover.resetSize", () =>
        this.setWidth(null),
      ),
    );
    this.controls.appendChild(popover);

    const handle = document.createElement("span");
    handle.className = "image-resize-handle";
    handle.title = i18n.t("image.resizeHandle");
    this.localizedTitles.push({ el: handle, key: "image.resizeHandle" });
    handle.addEventListener("mousedown", this.startResize);
    this.controls.appendChild(handle);

    this.widthLabel = document.createElement("span");
    this.widthLabel.className = "image-width-label";
    this.controls.appendChild(this.widthLabel);

    this.dom.appendChild(this.controls);

    this.applyAttrs(node);
    i18n.on("languageChanged", this.onLanguageChanged);
  }

  private makeBtn(label: string, titleKey: string, onClick: () => void) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "image-btn";
    b.textContent = label;
    b.title = i18n.t(titleKey);
    b.tabIndex = -1;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    this.localizedTitles.push({ el: b, key: titleKey });
    return b;
  }

  private relabel() {
    for (const { el, key } of this.localizedTitles) {
      el.title = i18n.t(key);
    }
  }

  private applyAttrs(node: Node) {
    const src = String(node.attrs.src ?? "");
    this.img.src = resolveImageSrc(src, this.getDocPath());
    this.img.alt = String(node.attrs.alt ?? "");
    const title = node.attrs.title;
    if (typeof title === "string" && title) this.img.title = title;
    else this.img.removeAttribute("title");

    const width = node.attrs.width as string | null;
    if (width) {
      // CSS `zoom` is what Typora writes too. We mirror it on the img so
      // the size matches the round-tripped HTML exactly.
      this.img.style.zoom = width;
      this.dom.classList.add("has-width");
      this.widthLabel.textContent = width;
    } else {
      this.img.style.zoom = "";
      this.dom.classList.remove("has-width");
      this.widthLabel.textContent = "";
    }

    const align = node.attrs.align as Align;
    this.dom.classList.toggle("align-left", align === "left");
    this.dom.classList.toggle("align-center", align === "center");
    this.dom.classList.toggle("align-right", align === "right");
  }

  update(node: Node) {
    if (node.type.name !== "image") return false;
    this.node = node;
    if (!this.resizing) this.applyAttrs(node);
    return true;
  }

  selectNode() {
    this.dom.classList.add("ProseMirror-selectednode", "selected");
  }

  deselectNode() {
    this.dom.classList.remove("ProseMirror-selectednode", "selected");
  }

  private setAlign(align: Align) {
    const pos = this.getPos();
    if (pos === undefined) return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      align,
    });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.view.dispatch(tr);
    this.view.focus();
  }

  private setWidth(width: string | null) {
    const pos = this.getPos();
    if (pos === undefined) return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      width,
    });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.view.dispatch(tr);
    this.view.focus();
  }

  private openAltDialog() {
    const detail: ImageAltEditDetail = {
      alt: String(this.node.attrs.alt ?? ""),
      title: String(this.node.attrs.title ?? ""),
      commit: (alt, title) => {
        const pos = this.getPos();
        if (pos === undefined) return;
        const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          alt: alt || null,
          title: title || null,
        });
        this.view.dispatch(tr);
      },
    };
    this.dom.dispatchEvent(
      new CustomEvent<ImageAltEditDetail>("tylike:image-alt-edit", {
        bubbles: true,
        detail,
      }),
    );
  }

  private openLightbox() {
    const detail: ImageLightboxDetail = {
      src: this.img.src,
      alt: String(this.node.attrs.alt ?? ""),
    };
    this.dom.dispatchEvent(
      new CustomEvent<ImageLightboxDetail>("tylike:image-lightbox", {
        bubbles: true,
        detail,
      }),
    );
  }

  private startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.resizing = true;
    const startX = e.clientX;
    const rect = this.img.getBoundingClientRect();
    const startWidth = rect.width;
    // Width is stored as a percentage of natural size — same convention
    // as `style="zoom: 60%"` in the markdown round-trip.
    const natural = this.img.naturalWidth || startWidth || 1;
    const startPct = Math.round((startWidth / natural) * 100);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const nextWidth = Math.max(32, startWidth + dx);
      const pct = Math.max(5, Math.round((nextWidth / natural) * 100));
      this.pendingWidth = `${pct}%`;
      this.img.style.zoom = this.pendingWidth;
      this.widthLabel.textContent = this.pendingWidth;
      this.dom.classList.add("has-width");
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      this.resizing = false;
      const finalWidth =
        this.pendingWidth && this.pendingWidth !== `${startPct}%`
          ? this.pendingWidth
          : null;
      this.pendingWidth = null;
      if (finalWidth) {
        this.setWidth(finalWidth);
      } else {
        // No real change — restore from the unmodified node attrs.
        this.applyAttrs(this.node);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ProseMirror would otherwise try to read mutations on our injected
  // controls and fight us — `ignoreMutation` keeps it out of our DOM.
  ignoreMutation(mutation: ViewMutationRecord) {
    if (this.controls.contains(mutation.target as globalThis.Node)) return true;
    return false;
  }

  stopEvent(event: Event) {
    // Click / mousedown on controls are ours, not ProseMirror's.
    return this.controls.contains(event.target as globalThis.Node);
  }

  destroy() {
    i18n.off("languageChanged", this.onLanguageChanged);
  }
}

export function buildImageNodeView(getDocPath: () => string | null) {
  return {
    image: (
      node: Node,
      view: EditorView,
      getPos: () => number | undefined,
    ) => new ImageView(node, view, getPos, getDocPath),
  };
}
