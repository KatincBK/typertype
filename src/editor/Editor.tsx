import { useEffect, useRef } from "react";
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
import { logger } from "@/lib/logger";

import "prosemirror-view/style/prosemirror.css";
import "./editor.css";

interface EditorProps {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
}

export function Editor({ initialMarkdown = "", onChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: markdownToDoc(initialMarkdown),
      plugins: [
        buildInputRules(schema),
        // liveMath must run before liveFormat: $..$ contents (^ _ etc.)
        // would otherwise be partially marked as super/subscript first.
        buildLiveMathPlugin(schema),
        buildLiveFormatPlugin(schema),
        buildAutoPairPlugin(),
        buildKeymap(schema),
        keymap(baseKeymap),
        history(),
      ],
    });

    const mathViews = buildMathNodeViews();
    const view = new EditorView(containerRef.current, {
      state,
      nodeViews: {
        ...mathViews,
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
  }, [initialMarkdown]);

  return <div ref={containerRef} className="editor" />;
}
