import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorView } from "prosemirror-view";
import type { Node } from "prosemirror-model";
import { checkWord, onSpellChange } from "@/lib/spellChecker";

export interface SpellContextDetail {
  word: string;
  from: number;
  to: number;
  x: number;
  y: number;
}

// FAZ 18 — Spell-check decorations. The plugin owns a DecorationSet
// keyed by misspelled word ranges. On every doc change we map the
// existing set through the transaction (cheap) and schedule a rescan
// 300 ms after typing stops (full doc rescan, dispatched as a "rescan"
// meta). The dictionary loader fires onSpellChange when it becomes
// ready or the user adds a word, which also triggers a rescan.

export const spellPluginKey = new PluginKey<DecorationSet>("spell");

// Block / inline node names whose textual content is *not* prose and
// shouldn't get squiggles.
const SKIP_NODE_TYPES = new Set([
  "code_block",
  "math_block",
  "math_inline",
  "emoji",
  "footnote_ref",
  "toc",
  "horizontal_rule",
  "image",
]);

// Marks whose text we skip — code spans are identifiers, link hrefs are
// URLs masquerading as words, and `markup` text is the literal `**` / `<u>`
// syntax characters, not prose.
const SKIP_MARK_TYPES = new Set(["code", "link", "markup"]);

const WORD_SCAN = /[\p{L}][\p{L}\p{M}'’\-]*/gu;
const HAS_DIGIT = /\d/;

function shouldSkipWord(word: string): boolean {
  // 1-letter tokens are noise (initials, articles already correct);
  // tokens with digits are identifiers / version numbers.
  return word.length < 2 || HAS_DIGIT.test(word);
}

function scanDoc(doc: Node): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos, parent) => {
    if (parent && SKIP_NODE_TYPES.has(parent.type.name)) return false;
    if (SKIP_NODE_TYPES.has(node.type.name)) return false;
    if (!node.isText) return true;
    if (node.marks.some((m) => SKIP_MARK_TYPES.has(m.type.name))) return false;

    const text = node.text || "";
    let m: RegExpExecArray | null;
    WORD_SCAN.lastIndex = 0;
    while ((m = WORD_SCAN.exec(text)) !== null) {
      const word = m[0];
      if (shouldSkipWord(word)) continue;
      if (checkWord(word)) continue;
      const from = pos + m.index;
      const to = from + word.length;
      decos.push(
        Decoration.inline(
          from,
          to,
          { class: "spell-error" },
          // The third arg is the spec, kept off the DOM. Stashing the
          // word here lets the contextmenu handler look up suggestions
          // without re-extracting from the doc.
          { word },
        ),
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}

const RESCAN_DELAY_MS = 300;

export function buildSpellPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: spellPluginKey,
    state: {
      init(_, state) {
        return scanDoc(state.doc);
      },
      apply(tr, value) {
        if (tr.getMeta(spellPluginKey) === "rescan") {
          return scanDoc(tr.doc);
        }
        if (tr.docChanged) {
          return value.map(tr.mapping, tr.doc);
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        return spellPluginKey.getState(state);
      },
      handleDOMEvents: {
        contextmenu(view: EditorView, event: Event) {
          const e = event as MouseEvent;
          const decoSet = spellPluginKey.getState(view.state);
          if (!decoSet) return false;
          const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
          if (!hit) return false;
          // find() with the same from/to picks up decorations that
          // contain this single position.
          const matches = decoSet.find(hit.pos, hit.pos);
          if (matches.length === 0) return false;
          const deco = matches[0];
          // The word is stashed on the decoration spec at scan time so
          // we don't have to re-extract it from the doc.
          const spec = deco.spec as { word?: string } | undefined;
          const word =
            spec?.word ?? view.state.doc.textBetween(deco.from, deco.to);
          const detail: SpellContextDetail = {
            word,
            from: deco.from,
            to: deco.to,
            x: e.clientX,
            y: e.clientY,
          };
          view.dom.dispatchEvent(
            new CustomEvent<SpellContextDetail>("tylike:spell-context", {
              bubbles: true,
              detail,
            }),
          );
          e.preventDefault();
          return true;
        },
      },
    },
    view(view) {
      let timer: number | null = null;
      const scheduleRescan = () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          timer = null;
          view.dispatch(view.state.tr.setMeta(spellPluginKey, "rescan"));
        }, RESCAN_DELAY_MS);
      };
      // Whenever the dictionary engine becomes ready or new words are
      // added/ignored, rescan so flagged words clear or new ones light up.
      const unsubscribe = onSpellChange(scheduleRescan);
      return {
        update(updateView, prevState) {
          if (updateView.state.doc === prevState.doc) return;
          scheduleRescan();
        },
        destroy() {
          if (timer !== null) window.clearTimeout(timer);
          unsubscribe();
        },
      };
    },
  });
}
