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
import { logger } from "@/lib/logger";

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-tables/style/tables.css";
import "./editor.css";

interface EditorProps {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
}

// Imperative handle exposed to App so the outline panel can scroll the
// editor to a clicked heading. The Editor itself stays uncontrolled.
//
// Jump-by-index instead of jump-by-text because heading textContent in the
// doc strips inline marks and atom nodes (emoji, math_inline) — which
// extractHeadings on the raw markdown sees verbatim. Matching positionally
// avoids the comparison mismatch entirely.
export interface EditorHandle {
  scrollToHeadingByIndex: (index: number) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { initialMarkdown = "", onChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
        buildAutoPairPlugin(),
        buildEmojiPopupPlugin(),
        buildTocRefreshPlugin(),
        buildFocusBlockPlugin(),
        buildTableToolbarPlugin(),
        ...buildTablePlugins(),
        buildKeymap(schema, overrides),
        keymap(baseKeymap),
        history(),
      ],
    });

    const view = new EditorView(containerRef.current, {
      state,
      nodeViews: {
        ...buildMathNodeViews(),
        ...buildEmojiNodeView(),
        ...buildTocNodeView(),
        ...buildFootnoteNodeView(),
        code_block: (node) => new CodeBlockView(node),
      },
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) {
          onChangeRef.current?.(docToMarkdown(next.doc));
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

  return <div ref={containerRef} className="editor" />;
});
