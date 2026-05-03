import { Plugin } from "prosemirror-state";
import type { Schema } from "prosemirror-model";

interface PatternConfig {
  regex: RegExp;
  markName: string;
}

// Patterns ordered by priority — earlier ones win on overlap.
// Strong before em (so **x** wins over *x*); strikethrough before subscript;
// highlight is unique. Inline code is unique. Sup/sub are independent.
const PATTERNS: PatternConfig[] = [
  { regex: /\*\*([^*]+)\*\*/g, markName: "strong" },
  { regex: /~~([^~]+)~~/g, markName: "strikethrough" },
  { regex: /==([^=]+)==/g, markName: "highlight" },
  { regex: /`([^`]+)`/g, markName: "code" },
  { regex: /(?<!\*)\*([^*\s][^*]*?[^*\s]|[^*\s])\*(?!\*)/g, markName: "em" },
  { regex: /(?<!~)~([^~\s][^~]*?[^~\s]|[^~\s])~(?!~)/g, markName: "subscript" },
  { regex: /(?<!\^)\^([^\^\s][^\^]*?[^\^\s]|[^\^\s])\^(?!\^)/g, markName: "superscript" },
];

interface Replacement {
  from: number;
  to: number;
  captured: string;
  markName: string;
}

export function buildLiveFormatPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      // Avoid loops: don't process our own transactions
      if (transactions.some((tr) => tr.getMeta("liveFormat") === true)) return null;

      const all: Replacement[] = [];

      newState.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const existing = new Set(node.marks.map((m) => m.type.name));
        for (const pattern of PATTERNS) {
          if (existing.has(pattern.markName)) continue;
          if (!schema.marks[pattern.markName]) continue;
          for (const match of node.text.matchAll(pattern.regex)) {
            if (match.index === undefined) continue;
            const captured = match[1];
            if (!captured) continue;
            all.push({
              from: pos + match.index,
              to: pos + match.index + match[0].length,
              captured,
              markName: pattern.markName,
            });
          }
        }
      });

      // Skip overlapping replacements (priority order kept; first wins)
      const nonOverlap: Replacement[] = [];
      for (const r of all) {
        const overlaps = nonOverlap.some(
          (other) => !(r.to <= other.from || r.from >= other.to),
        );
        if (!overlaps) nonOverlap.push(r);
      }

      if (nonOverlap.length === 0) return null;

      // Apply from end to start so earlier positions stay valid
      nonOverlap.sort((a, b) => b.from - a.from);

      const tr = newState.tr;
      tr.setMeta("liveFormat", true);

      for (const r of nonOverlap) {
        const markType = schema.marks[r.markName];
        if (!markType) continue;
        const baseMarks = newState.doc.resolve(r.from).marks();
        const newMarks = markType.create().addToSet(baseMarks);
        tr.replaceWith(r.from, r.to, schema.text(r.captured, newMarks));
      }

      return tr;
    },
  });
}
