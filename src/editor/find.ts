import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node } from "prosemirror-model";

// MVP-4 — Find / Replace plugin.
// State holds the query, options, and the list of all matches in the doc.
// Decorations highlight every match; the current match gets an extra class.
// The plugin recomputes matches whenever the query/options change OR the
// doc changes (so replacements / typing keep the highlight in sync).

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindStatus {
  query: string;
  options: FindOptions;
  matches: FindMatch[];
  /** -1 when there is no current match (no query, no hits). */
  currentIndex: number;
}

export const findPluginKey = new PluginKey<FindStatus>("find");

export const DEFAULT_FIND_OPTIONS: FindOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

export type FindMeta =
  | { type: "set"; query?: string; options?: FindOptions }
  | { type: "advance"; direction: "next" | "prev" }
  | { type: "select"; index: number }
  | { type: "clear" };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null;
  const flags = opts.caseSensitive ? "g" : "gi";
  try {
    if (opts.regex) return new RegExp(query, flags);
    let pattern = escapeRegex(query);
    if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
    return new RegExp(pattern, flags);
  } catch {
    return null; // invalid user-typed regex
  }
}

export function findAllMatches(
  doc: Node,
  query: string,
  options: FindOptions,
): FindMatch[] {
  const re = buildRegex(query, options);
  if (!re) return [];
  const matches: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text))) {
      matches.push({
        from: pos + m.index,
        to: pos + m.index + m[0].length,
      });
      // Avoid infinite loops on zero-width matches (e.g. /^/g)
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return matches;
}

export function buildFindPlugin(): Plugin<FindStatus> {
  return new Plugin<FindStatus>({
    key: findPluginKey,
    state: {
      init: () => ({
        query: "",
        options: { ...DEFAULT_FIND_OPTIONS },
        matches: [],
        currentIndex: -1,
      }),
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(findPluginKey) as FindMeta | undefined;

        if (meta?.type === "clear") {
          return {
            query: "",
            options: prev.options,
            matches: [],
            currentIndex: -1,
          };
        }

        if (meta?.type === "advance") {
          const total = prev.matches.length;
          if (total === 0) return prev;
          const dir = meta.direction === "next" ? 1 : -1;
          const idx = ((prev.currentIndex + dir) % total + total) % total;
          return { ...prev, currentIndex: idx };
        }

        if (meta?.type === "select") {
          if (meta.index < 0 || meta.index >= prev.matches.length) return prev;
          return { ...prev, currentIndex: meta.index };
        }

        let next = prev;
        let recompute = false;

        if (meta?.type === "set") {
          next = {
            ...prev,
            query: meta.query ?? prev.query,
            options: meta.options ?? prev.options,
          };
          recompute = true;
        }

        if (tr.docChanged && next.query) {
          recompute = true;
        }

        if (!recompute) return next;

        const matches = findAllMatches(newState.doc, next.query, next.options);
        let idx = next.currentIndex;
        if (idx < 0 && matches.length > 0) idx = 0;
        if (idx >= matches.length) idx = matches.length > 0 ? 0 : -1;
        return { ...next, matches, currentIndex: idx };
      },
    },
    props: {
      decorations(state) {
        const s = findPluginKey.getState(state);
        if (!s || s.matches.length === 0) return DecorationSet.empty;
        const decos = s.matches.map((m, i) =>
          Decoration.inline(m.from, m.to, {
            class:
              i === s.currentIndex
                ? "find-match find-current"
                : "find-match",
          }),
        );
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}
