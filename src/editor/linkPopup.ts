import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { openUrl } from "@tauri-apps/plugin-opener";
import i18n from "@/lib/i18n";
import { logger } from "@/lib/logger";

// Faz G — Typora-style link editor. `link` is the one inline-format mark
// that still uses the consumed-marker model: the parser eats `[text](url)`
// into a `link` mark with `href` in attrs, and the serializer writes the
// classic shape back out. So the user never sees `[..](..)` in the doc —
// they just see the styled text. This plugin gives them a way to edit /
// open / remove the link without resorting to window.prompt.
//
// Trigger: any time the selection touches a `link` mark run, the popup
// appears below the link's start. The URL input applies on Enter / blur,
// "Aç" hands off to the system browser via Tauri opener, "Kaldır" strips
// the mark over the full run. Ctrl/Cmd+Click on a link also opens it
// (wired by handleClick below).

interface LinkInfo {
  from: number;
  to: number;
  href: string;
  title: string | null;
}

interface PopupState {
  active: LinkInfo | null;
  focusInput: boolean;
  // When the user dismisses the popup with Esc, focusing the editor
  // re-runs apply with the caret still inside the link — we'd reopen
  // the popup instantly. Stash the link range we just dismissed and
  // keep the popup closed until the caret actually leaves it.
  suppressedFor: { from: number; to: number } | null;
}

export const linkPopupKey = new PluginKey<PopupState>("linkPopup");

function findLinkAtSelection(state: EditorState): LinkInfo | null {
  const linkType = state.schema.marks.link;
  if (!linkType) return null;
  const { from: selFrom, to: selTo } = state.selection;
  let result: LinkInfo | null = null;
  state.doc.descendants((node, nodePos) => {
    if (result) return false;
    if (!node.isText) return;
    const linkMark = node.marks.find((m) => m.type === linkType);
    if (!linkMark) return;
    const from = nodePos;
    const to = nodePos + node.nodeSize;
    // Selection touches the run (endpoints inclusive) → show the popup.
    if (selFrom > to || selTo < from) return;
    result = {
      from,
      to,
      href: linkMark.attrs.href || "",
      title: linkMark.attrs.title ?? null,
    };
  });
  return result;
}

function infoEq(a: LinkInfo | null, b: LinkInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.href === b.href &&
    a.title === b.title
  );
}

class LinkPopupView {
  private popup: HTMLElement;
  private input: HTMLInputElement;
  private editorView: EditorView;
  private current: LinkInfo | null = null;
  private localized: Array<{ el: HTMLElement; key: string; attr: "text" | "placeholder" }> = [];

  constructor(view: EditorView) {
    this.editorView = view;
    this.popup = document.createElement("div");
    this.popup.className = "link-popup";
    this.popup.style.display = "none";

    // Clicking the popup chrome (everything but the input itself) shouldn't
    // collapse the doc selection — that's how mathDecorations' widget click
    // bug worked, and the same fix applies: stop the mousedown from reaching
    // ProseMirror's default handling.
    this.popup.addEventListener("mousedown", (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT") {
        e.preventDefault();
      }
    });

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "link-popup-input";
    this.input.placeholder = i18n.t("link.popup.urlPlaceholder");
    this.localized.push({ el: this.input, key: "link.popup.urlPlaceholder", attr: "placeholder" });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.applyHref(this.input.value);
        this.editorView.focus();
      }
    });
    this.input.addEventListener("blur", () => {
      if (this.current && this.input.value.trim() !== this.current.href) {
        this.applyHref(this.input.value);
      }
    });
    this.popup.appendChild(this.input);

    this.popup.appendChild(
      this.makeBtn("link.popup.open", () => this.openLink()),
    );
    this.popup.appendChild(
      this.makeBtn("link.popup.remove", () => this.removeLink()),
    );

    document.body.appendChild(this.popup);
    i18n.on("languageChanged", this.onLanguageChanged);
    this.update(view);
  }

  private onLanguageChanged = () => {
    for (const { el, key, attr } of this.localized) {
      if (attr === "placeholder") {
        (el as HTMLInputElement).placeholder = i18n.t(key);
      } else {
        el.textContent = i18n.t(key);
      }
    }
  };

  private makeBtn(labelKey: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link-popup-btn";
    b.textContent = i18n.t(labelKey);
    this.localized.push({ el: b, key: labelKey, attr: "text" });
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }

  update(view: EditorView) {
    this.editorView = view;
    const pluginState = linkPopupKey.getState(view.state);
    if (!pluginState || !pluginState.active) {
      this.hide();
      return;
    }
    if (!infoEq(pluginState.active, this.current)) {
      this.current = pluginState.active;
      this.input.value = pluginState.active.href;
    }
    this.show(pluginState.active);
    if (pluginState.focusInput) {
      this.input.focus();
      this.input.select();
      view.dispatch(view.state.tr.setMeta(linkPopupKey, { type: "clearFocus" }));
    }
  }

  private show(info: LinkInfo) {
    let coords;
    try {
      coords = this.editorView.coordsAtPos(info.from);
    } catch {
      this.hide();
      return;
    }
    this.popup.style.display = "flex";
    this.popup.style.left = coords.left + "px";
    this.popup.style.top = coords.bottom + 4 + "px";
  }

  private hide() {
    this.popup.style.display = "none";
    this.current = null;
  }

  private close() {
    this.editorView.dispatch(
      this.editorView.state.tr.setMeta(linkPopupKey, { type: "close" }),
    );
    this.editorView.focus();
  }

  private applyHref(href: string) {
    if (!this.current) return;
    const linkType = this.editorView.state.schema.marks.link;
    if (!linkType) return;
    const { from, to, title } = this.current;
    const tr = this.editorView.state.tr;
    tr.removeMark(from, to, linkType);
    const trimmed = href.trim();
    if (trimmed) {
      tr.addMark(from, to, linkType.create({ href: trimmed, title }));
    }
    this.editorView.dispatch(tr);
  }

  private openLink() {
    const href = (this.input.value || this.current?.href || "").trim();
    if (!href) return;
    openUrl(href).catch((err) => logger.warn("openUrl failed:", err));
  }

  private removeLink() {
    if (!this.current) return;
    const linkType = this.editorView.state.schema.marks.link;
    if (!linkType) return;
    const { from, to } = this.current;
    this.editorView.dispatch(
      this.editorView.state.tr.removeMark(from, to, linkType),
    );
    this.editorView.focus();
  }

  destroy() {
    i18n.off("languageChanged", this.onLanguageChanged);
    this.popup.remove();
  }
}

export function buildLinkPopupPlugin(): Plugin<PopupState> {
  return new Plugin<PopupState>({
    key: linkPopupKey,
    state: {
      init: (_config, state) => ({
        active: findLinkAtSelection(state),
        focusInput: false,
        suppressedFor: null,
      }),
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(linkPopupKey) as { type: string } | undefined;
        if (meta?.type === "close") {
          const current = findLinkAtSelection(newState);
          return {
            active: null,
            focusInput: false,
            suppressedFor: current
              ? { from: current.from, to: current.to }
              : null,
          };
        }
        if (meta?.type === "focus") {
          const active = findLinkAtSelection(newState);
          return { active, focusInput: !!active, suppressedFor: null };
        }
        if (meta?.type === "clearFocus") {
          return { ...prev, focusInput: false };
        }

        const newActive = findLinkAtSelection(newState);

        // Caret still parked inside the link the user just dismissed →
        // hold the popup closed instead of letting normal flow reopen it.
        if (
          prev.suppressedFor &&
          newActive &&
          prev.suppressedFor.from === newActive.from &&
          prev.suppressedFor.to === newActive.to
        ) {
          if (prev.active === null && !prev.focusInput) return prev;
          return { active: null, focusInput: false, suppressedFor: prev.suppressedFor };
        }

        // Caret left the dismissed link (or it changed) → suppression
        // expires; fall through to normal popup tracking.
        if (infoEq(prev.active, newActive) && prev.suppressedFor === null) {
          return prev;
        }
        return { active: newActive, focusInput: false, suppressedFor: null };
      },
    },
    props: {
      // Ctrl/Cmd+Click on a link → hand off to the system browser. We do
      // this here (not on a DOM listener) so it cooperates with PM's own
      // click handling instead of fighting it.
      handleClick(view, _pos, event) {
        if (!event.ctrlKey && !event.metaKey) return false;
        const active = findLinkAtSelection(view.state);
        if (!active || !active.href) return false;
        openUrl(active.href).catch((err) => logger.warn("openUrl failed:", err));
        return true;
      },
    },
    view(editorView) {
      return new LinkPopupView(editorView);
    },
  });
}
