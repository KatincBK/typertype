import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { schema } from "./schema";
import { docToMarkdown, markdownToDoc } from "./serializer";
import { buildKeymap } from "./keymap";
import { buildInputRules } from "./inputRules";
import { buildLiveFormatPlugin } from "./liveFormat";
import { buildMarkupVisibilityPlugin } from "./markupVisibility";
import { buildAutoPairPlugin } from "./autoPair";
import { buildLiveMathPlugin, buildMathNodeViews } from "./math";
import { CodeBlockView } from "./mermaid";
import {
  buildEmojiNodeView,
  buildEmojiPopupPlugin,
  buildLiveEmojiPlugin,
} from "./emoji";
import { buildTocNodeView, buildTocRefreshPlugin } from "./toc";
import { buildFootnoteNodeView } from "./footnote";
import { buildTablePlugins, buildTableToolbarPlugin } from "./tables";
import { buildFocusBlockPlugin } from "./focusBlock";
import { loadUserConfig } from "./customConfig";
import {
  buildFindPlugin,
  findPluginKey,
  type FindOptions,
  type FindStatus,
} from "./find";
import { buildImageNodeView } from "./imageView";
import {
  buildImagePastePlugin,
  insertImageFromDialog,
  insertImageFromPath,
} from "./imageHandlers";
import { buildSpellPlugin } from "./spell";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { logger } from "@/lib/logger";

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-tables/style/tables.css";
import "./editor.css";

export interface FindReportStatus {
  matchCount: number;
  currentIndex: number;
}

interface EditorProps {
  initialMarkdown?: string;
  /** Path of the doc currently in the editor — used for resolving
   *  relative image paths and for the assets-folder location. */
  currentFilePath?: string | null;
  onChange?: (markdown: string) => void;
  onFindChange?: (status: FindReportStatus) => void;
}

// Imperative handle exposed to App so the outline panel and the find bar
// can drive the editor without making it a fully controlled component.
export interface EditorHandle {
  scrollToHeadingByIndex: (index: number) => void;
  findSet: (query: string, options: FindOptions) => void;
  findNext: () => void;
  findPrev: () => void;
  findClose: () => void;
  replaceCurrent: (replacement: string) => void;
  replaceAll: (replacement: string) => void;
  insertImageFromDialog: () => void;
  replaceRange: (from: number, to: number, text: string) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { initialMarkdown = "", currentFilePath = null, onChange, onFindChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFindChangeRef = useRef(onFindChange);
  onFindChangeRef.current = onFindChange;
  const filePathRef = useRef<string | null>(currentFilePath);
  filePathRef.current = currentFilePath;
  const getDocPath = () => filePathRef.current;

  // Adım 13 — load user keymap overrides on mount. Editor mounts only after
  // the config has been loaded (or failed gracefully) so the keymap is
  // built once with the right bindings.
  const [overrides, setOverrides] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadUserConfig().then((cfg) => {
      if (cancelled) return;
      setOverrides(cfg.keymap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Find/replace helpers used by the imperative handle. Each one operates
  // on viewRef.current so they're inert when the editor isn't mounted.
  const advanceAndScroll = (direction: "next" | "prev") => {
    const view = viewRef.current;
    if (!view) return;
    const status = findPluginKey.getState(view.state);
    if (!status || status.matches.length === 0) return;
    const total = status.matches.length;
    const dir = direction === "next" ? 1 : -1;
    const idx = ((status.currentIndex + dir) % total + total) % total;
    const m = status.matches[idx];
    view.dispatch(
      view.state.tr
        .setMeta(findPluginKey, { type: "select", index: idx })
        .setSelection(TextSelection.create(view.state.doc, m.from, m.to))
        .scrollIntoView(),
    );
    view.focus();
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToHeadingByIndex(index) {
        const view = viewRef.current;
        if (!view) return;
        let count = 0;
        let target: number | null = null;
        view.state.doc.descendants((node, pos) => {
          if (target !== null) return false;
          if (node.type.name === "heading") {
            if (count === index) {
              target = pos;
              return false;
            }
            count++;
          }
        });
        if (target === null) return;
        const tr = view.state.tr.setSelection(
          TextSelection.create(view.state.doc, target + 1),
        );
        view.dispatch(tr.scrollIntoView());
        view.focus();
      },
      findSet(query, options) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(
          view.state.tr.setMeta(findPluginKey, {
            type: "set",
            query,
            options,
          }),
        );
      },
      findNext() {
        advanceAndScroll("next");
      },
      findPrev() {
        advanceAndScroll("prev");
      },
      findClose() {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(view.state.tr.setMeta(findPluginKey, { type: "clear" }));
      },
      replaceCurrent(replacement) {
        const view = viewRef.current;
        if (!view) return;
        const status = findPluginKey.getState(view.state);
        if (!status || status.currentIndex < 0) return;
        const match = status.matches[status.currentIndex];
        const tr = view.state.tr;
        // Preserve the marks at the start of the match so replacing inside
        // bold / em / etc. text keeps the styling.
        const startNode = view.state.doc.nodeAt(match.from);
        const marks = startNode?.marks ?? [];
        if (replacement) {
          tr.replaceWith(
            match.from,
            match.to,
            view.state.schema.text(replacement, marks),
          );
        } else {
          tr.delete(match.from, match.to);
        }
        view.dispatch(tr.scrollIntoView());
        // Plugin recomputes matches on docChanged; advance to next manually
        // after dispatch so the user sees the cursor land on the next hit.
        queueMicrotask(() => advanceAndScroll("next"));
      },
      replaceAll(replacement) {
        const view = viewRef.current;
        if (!view) return;
        const status = findPluginKey.getState(view.state);
        if (!status || status.matches.length === 0) return;
        const tr = view.state.tr;
        // Apply from end to start so earlier offsets stay valid (replaces
        // before this point don't shift positions ≤ this match's start).
        const ordered = [...status.matches].sort((a, b) => b.from - a.from);
        for (const m of ordered) {
          const startNode = view.state.doc.nodeAt(m.from);
          const marks = startNode?.marks ?? [];
          if (replacement) {
            tr.replaceWith(
              m.from,
              m.to,
              view.state.schema.text(replacement, marks),
            );
          } else {
            tr.delete(m.from, m.to);
          }
        }
        view.dispatch(tr);
      },
      insertImageFromDialog() {
        const view = viewRef.current;
        if (!view) return;
        void insertImageFromDialog(view, getDocPath);
      },
      replaceRange(from, to, text) {
        const view = viewRef.current;
        if (!view) return;
        // Carry the marks at the start of the range so a corrected
        // word inside bold / em / etc. text keeps its styling.
        const startNode = view.state.doc.nodeAt(from);
        const marks = startNode?.marks ?? [];
        const tr = view.state.tr;
        if (text) {
          tr.replaceWith(from, to, view.state.schema.text(text, marks));
        } else {
          tr.delete(from, to);
        }
        view.dispatch(tr);
        view.focus();
      },
    }),
    [],
  );

  useEffect(() => {
    if (!containerRef.current || overrides === null) return;

    const state = EditorState.create({
      doc: markdownToDoc(initialMarkdown),
      plugins: [
        buildInputRules(schema),
        // liveMath before liveFormat so $..$ contents (^ _) aren't grabbed
        // by sup/sub marks first. liveEmoji is independent of those.
        buildLiveMathPlugin(schema),
        buildLiveEmojiPlugin(schema),
        buildLiveFormatPlugin(schema),
        // Typora-style reveal/hide of the literal `**` `*` … markers.
        buildMarkupVisibilityPlugin(),
        buildAutoPairPlugin(),
        buildEmojiPopupPlugin(),
        buildTocRefreshPlugin(),
        buildFocusBlockPlugin(),
        buildTableToolbarPlugin(),
        ...buildTablePlugins(),
        buildImagePastePlugin(schema, getDocPath),
        buildSpellPlugin(),
        buildFindPlugin(),
        buildKeymap(schema, overrides),
        keymap(baseKeymap),
        history(),
      ],
    });

    let lastReported: FindStatus | null = null;
    const view = new EditorView(containerRef.current, {
      state,
      nodeViews: {
        ...buildMathNodeViews(),
        ...buildEmojiNodeView(),
        ...buildTocNodeView(),
        ...buildFootnoteNodeView(),
        ...buildImageNodeView(getDocPath),
        code_block: (node) => new CodeBlockView(node),
      },
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) {
          onChangeRef.current?.(docToMarkdown(next.doc));
        }
        const findStatus = findPluginKey.getState(next);
        if (findStatus) {
          if (
            !lastReported ||
            lastReported.matches !== findStatus.matches ||
            lastReported.currentIndex !== findStatus.currentIndex
          ) {
            onFindChangeRef.current?.({
              matchCount: findStatus.matches.length,
              currentIndex: findStatus.currentIndex,
            });
            lastReported = findStatus;
          }
        }
      },
    });
    viewRef.current = view;

    logger.info("Editor mounted with", state.plugins.length, "plugins");

    return () => {
      view.destroy();
      viewRef.current = null;
      logger.info("Editor destroyed");
    };
  }, [initialMarkdown, overrides]);

  // FAZ 11 — Tauri's drag-drop event gives us the absolute paths the OS
  // dropped onto the window, plus the cursor position in physical
  // pixels. We resolve that to a doc position via posAtCoords and copy
  // any image files into the doc's assets folder. Bound once with the
  // viewRef + filePathRef pattern so the listener doesn't have to
  // re-bind on every keystroke.
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;
    void listen<{ paths: string[]; position: { x: number; y: number } }>(
      "tauri://drag-drop",
      async (e) => {
        const view = viewRef.current;
        if (!view) return;
        const { paths, position } = e.payload;
        if (!paths || paths.length === 0) return;
        const dpr = window.devicePixelRatio || 1;
        const coords = {
          left: position.x / dpr,
          top: position.y / dpr,
        };
        const hit = view.posAtCoords(coords);
        if (!hit) return;
        for (const path of paths) {
          await insertImageFromPath(view, path, hit.pos, getDocPath);
        }
      },
    ).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return <div ref={containerRef} className="editor" />;
});
