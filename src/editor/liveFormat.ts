import { Plugin } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import type { Transaction } from "prosemirror-state";

// Typora-style "the text is the source" model: markdown markers (`**` `*`
// `~~` `==` `` ` `` `~` `^` `<u></u>`) live in the document as real, editable
// text. This plugin is the inline RE-PARSER — on every doc change it derives
// the style marks (strong / em / …) plus the `markup` mark (on the marker
// characters themselves) from that literal text, WITHOUT ever changing the
// text. Deleting a marker character therefore just drops the formatting on
// the next reparse — exactly Typora's behaviour.
//
// Mirrors the old liveFormat in spirit (appendTransaction + loop guard) but
// it no longer rewrites text — it only reconciles marks. The same core
// (`applyInlineMarks`) is reused by `markdownToDoc` so a freshly loaded file
// gets its marks too.

interface Pattern {
  regex: RegExp;
  markName: string;
  openLen: number;
  closeLen: number;
}

// Priority order — earlier wins when two patterns match at the same index.
// Each content group forbids its own delimiter char, which keeps a weaker
// pair from straddling a stronger one (e.g. em won't eat across `**`).
// No `g` flag: `parseSegment` calls `.exec` once for the leftmost match.
const PATTERNS: Pattern[] = [
  { regex: /\*\*([^*]+)\*\*/, markName: "strong", openLen: 2, closeLen: 2 },
  { regex: /~~([^~]+)~~/, markName: "strikethrough", openLen: 2, closeLen: 2 },
  { regex: /==([^=]+)==/, markName: "highlight", openLen: 2, closeLen: 2 },
  { regex: /`([^`]+)`/, markName: "code", openLen: 1, closeLen: 1 },
  { regex: /<u>([\s\S]+?)<\/u>/, markName: "underline", openLen: 3, closeLen: 4 },
  {
    regex: /(?<!\*)\*([^*\s][^*]*?[^*\s]|[^*\s])\*(?!\*)/,
    markName: "em",
    openLen: 1,
    closeLen: 1,
  },
  {
    regex: /(?<!~)~([^~\s][^~]*?[^~\s]|[^~\s])~(?!~)/,
    markName: "subscript",
    openLen: 1,
    closeLen: 1,
  },
  {
    regex: /(?<!\^)\^([^\^\s][^\^]*?[^\^\s]|[^\^\s])\^(?!\^)/,
    markName: "superscript",
    openLen: 1,
    closeLen: 1,
  },
];

// Every mark this plugin owns. `link` is intentionally absent — it stays on
// the old consumed-marker model until Faz D.
const MANAGED = [
  "strong",
  "em",
  "strikethrough",
  "highlight",
  "code",
  "subscript",
  "superscript",
  "underline",
  "markup",
] as const;

interface StyleSpan {
  markName: string;
  from: number;
  to: number;
}
interface MarkupSpan {
  from: number;
  to: number;
}

// Recursively find delimiter pairs in `text`. `base` is the document
// position of `text[0]`. Pushes resolved document-position spans.
function parseSegment(
  text: string,
  base: number,
  styleSpans: StyleSpan[],
  markupSpans: MarkupSpan[],
): void {
  let best:
    | {
        markName: string;
        index: number;
        fullLen: number;
        openLen: number;
        closeLen: number;
        content: string;
        contentStart: number;
      }
    | null = null;

  for (const p of PATTERNS) {
    const m = p.regex.exec(text);
    if (!m || m.index === undefined || !m[1]) continue;
    if (!best || m.index < best.index) {
      best = {
        markName: p.markName,
        index: m.index,
        fullLen: m[0].length,
        openLen: p.openLen,
        closeLen: p.closeLen,
        content: m[1],
        contentStart: m.index + p.openLen,
      };
    }
  }
  if (!best) return;

  const fullFrom = base + best.index;
  const fullTo = fullFrom + best.fullLen;
  styleSpans.push({ markName: best.markName, from: fullFrom, to: fullTo });
  markupSpans.push({ from: fullFrom, to: fullFrom + best.openLen });
  markupSpans.push({ from: fullTo - best.closeLen, to: fullTo });

  // `code` content is opaque — no nested parsing inside backticks.
  if (best.markName !== "code") {
    parseSegment(best.content, base + best.contentStart, styleSpans, markupSpans);
  }
  const rest = best.index + best.fullLen;
  parseSegment(text.slice(rest), base + rest, styleSpans, markupSpans);
}

interface Segment {
  text: string;
  from: number;
}

// Split every (non-code) textblock's inline content into runs of consecutive
// text — inline atoms (emoji / math / image / hard_break) break a run, since
// a marker pair can't straddle them.
function collectSegments(doc: Transaction["doc"]): Segment[] {
  const segments: Segment[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    // code_block / math_block hold literal source — never mark inside them.
    if (node.type.spec.code || node.type.name === "math_block") return false;
    const contentStart = pos + 1;
    let segText = "";
    let segFrom = -1;
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        if (segFrom === -1) segFrom = contentStart + offset;
        segText += child.text;
      } else if (segFrom !== -1) {
        segments.push({ text: segText, from: segFrom });
        segText = "";
        segFrom = -1;
      }
    });
    if (segFrom !== -1) segments.push({ text: segText, from: segFrom });
    return false;
  });
  return segments;
}

// Reconcile the marks in one text segment against what the literal text
// implies, emitting the minimal addMark / removeMark steps onto `tr`. Mark
// steps never shift positions, so `from` stays valid across segments.
function reconcileSegment(
  tr: Transaction,
  schema: Schema,
  text: string,
  from: number,
): void {
  const L = text.length;
  if (L === 0) return;

  const styleSpans: StyleSpan[] = [];
  const markupSpans: MarkupSpan[] = [];
  parseSegment(text, from, styleSpans, markupSpans);

  // desired[name][i] — should char i carry `name`?
  const desired: Record<string, boolean[]> = {};
  for (const name of MANAGED) desired[name] = new Array(L).fill(false);
  for (const s of styleSpans) {
    const arr = desired[s.markName];
    if (!arr) continue;
    for (let i = s.from - from; i < s.to - from; i++) arr[i] = true;
  }
  for (const s of markupSpans) {
    for (let i = s.from - from; i < s.to - from; i++) desired.markup[i] = true;
  }

  // current[name][i] — what the document has right now.
  const current: Record<string, boolean[]> = {};
  for (const name of MANAGED) current[name] = new Array(L).fill(false);
  tr.doc.nodesBetween(from, from + L, (node, pos) => {
    if (!node.isText) return;
    const start = Math.max(pos, from) - from;
    const end = Math.min(pos + node.nodeSize, from + L) - from;
    for (const mark of node.marks) {
      const arr = current[mark.type.name];
      if (!arr) continue;
      for (let i = start; i < end; i++) arr[i] = true;
    }
  });

  // Emit the minimal diff per mark type — runs where desired ≠ current.
  for (const name of MANAGED) {
    const markType = schema.marks[name];
    if (!markType) continue;
    const d = desired[name];
    const c = current[name];
    let i = 0;
    while (i < L) {
      if (d[i] === c[i]) {
        i++;
        continue;
      }
      const wantOn = d[i];
      let j = i + 1;
      while (j < L && d[j] === wantOn && c[j] !== wantOn) j++;
      if (wantOn) tr.addMark(from + i, from + j, markType.create());
      else tr.removeMark(from + i, from + j, markType);
      i = j;
    }
  }
}

// Public core — reused by both the plugin and `markdownToDoc`. Mutates `tr`,
// adding only mark steps (never content steps).
export function applyInlineMarks(tr: Transaction, schema: Schema): void {
  for (const seg of collectSegments(tr.doc)) {
    reconcileSegment(tr, schema, seg.text, seg.from);
  }
}

export function buildLiveFormatPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((t) => t.docChanged)) return null;
      // Avoid loops: don't reprocess our own mark-sync transaction.
      if (transactions.some((t) => t.getMeta("liveFormat") === true)) return null;
      const tr = newState.tr;
      applyInlineMarks(tr, schema);
      if (!tr.docChanged) return null;
      tr.setMeta("liveFormat", true);
      return tr;
    },
  });
}
