import { useEffect, useRef, useState } from "react";
import { EditorState } from "prosemirror-state";
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

export function Editor({ initialMarkdown = "", onChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

    logger.info("Editor mounted with", state.plugins.length, "plugins");

    return () => {
      view.destroy();
      logger.info("Editor destroyed");
    };
  }, [initialMarkdown, overrides]);

  return <div ref={containerRef} className="editor" />;
}
