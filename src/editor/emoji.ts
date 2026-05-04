import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Node, NodeSpec, Schema } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

// Adım 7 — Emoji as an inline atom node.
// Stores both the original `:shortcode:` and the resolved unicode `char` so
// the markdown source round-trips losslessly. Live conversion replaces a
// completed `:shortcode:` in plain text with this node; the autocomplete
// popup helps users discover shortcodes while typing.

export const emojiNodeSpec: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: {
    shortcode: { default: "" },
    char: { default: "" },
  },
  parseDOM: [
    {
      tag: "span.emoji",
      getAttrs: (el) => ({
        shortcode: (el as HTMLElement).getAttribute("data-shortcode") || "",
        char: el.textContent || "",
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    {
      class: "emoji",
      "data-shortcode": node.attrs.shortcode,
    },
    node.attrs.char,
  ],
};

// Curated subset of the most common emojis for autocomplete. The markdown
// parser still uses markdown-it-emoji's full database (~1500 entries) so
// `:less_common:` shortcodes coming in from a file still resolve — this list
// only constrains what appears in the popup.
export const EMOJI_DB: Array<{ shortcode: string; char: string; tags?: string[] }> = [
  { shortcode: "smile", char: "😄" },
  { shortcode: "smiley", char: "😃" },
  { shortcode: "grinning", char: "😀" },
  { shortcode: "joy", char: "😂", tags: ["laugh", "tears"] },
  { shortcode: "rofl", char: "🤣" },
  { shortcode: "laughing", char: "😆" },
  { shortcode: "wink", char: "😉" },
  { shortcode: "blush", char: "😊" },
  { shortcode: "heart_eyes", char: "😍" },
  { shortcode: "kissing_heart", char: "😘" },
  { shortcode: "yum", char: "😋" },
  { shortcode: "stuck_out_tongue", char: "😛" },
  { shortcode: "neutral_face", char: "😐" },
  { shortcode: "thinking", char: "🤔" },
  { shortcode: "pensive", char: "😔" },
  { shortcode: "frowning", char: "🙁" },
  { shortcode: "cry", char: "😢" },
  { shortcode: "sob", char: "😭" },
  { shortcode: "rage", char: "😡" },
  { shortcode: "angry", char: "😠" },
  { shortcode: "fire", char: "🔥" },
  { shortcode: "tada", char: "🎉", tags: ["party", "celebrate"] },
  { shortcode: "sparkles", char: "✨" },
  { shortcode: "rocket", char: "🚀" },
  { shortcode: "boom", char: "💥" },
  { shortcode: "star", char: "⭐" },
  { shortcode: "heart", char: "❤️", tags: ["love"] },
  { shortcode: "broken_heart", char: "💔" },
  { shortcode: "thumbsup", char: "👍", tags: ["+1", "yes"] },
  { shortcode: "thumbsdown", char: "👎", tags: ["-1", "no"] },
  { shortcode: "ok_hand", char: "👌" },
  { shortcode: "clap", char: "👏" },
  { shortcode: "wave", char: "👋", tags: ["hello"] },
  { shortcode: "pray", char: "🙏" },
  { shortcode: "muscle", char: "💪" },
  { shortcode: "raised_hands", char: "🙌" },
  { shortcode: "warning", char: "⚠️" },
  { shortcode: "white_check_mark", char: "✅", tags: ["done"] },
  { shortcode: "x", char: "❌" },
  { shortcode: "question", char: "❓" },
  { shortcode: "exclamation", char: "❗" },
  { shortcode: "bulb", char: "💡", tags: ["idea"] },
  { shortcode: "wrench", char: "🔧", tags: ["tool", "fix"] },
  { shortcode: "hammer", char: "🔨" },
  { shortcode: "gear", char: "⚙️" },
  { shortcode: "package", char: "📦" },
  { shortcode: "lock", char: "🔒" },
  { shortcode: "key", char: "🔑" },
  { shortcode: "books", char: "📚" },
  { shortcode: "pencil", char: "✏️" },
  { shortcode: "memo", char: "📝", tags: ["note"] },
  { shortcode: "scroll", char: "📜" },
  { shortcode: "page_facing_up", char: "📄" },
  { shortcode: "clipboard", char: "📋" },
  { shortcode: "calendar", char: "📅" },
  { shortcode: "clock", char: "🕐" },
  { shortcode: "hourglass", char: "⌛" },
  { shortcode: "zap", char: "⚡", tags: ["lightning"] },
  { shortcode: "sun", char: "☀️" },
  { shortcode: "moon", char: "🌙" },
  { shortcode: "cloud", char: "☁️" },
  { shortcode: "umbrella", char: "☂️" },
  { shortcode: "snowflake", char: "❄️" },
  { shortcode: "earth", char: "🌍" },
  { shortcode: "globe", char: "🌐" },
  { shortcode: "computer", char: "💻" },
  { shortcode: "phone", char: "📱" },
  { shortcode: "email", char: "📧" },
  { shortcode: "link", char: "🔗" },
  { shortcode: "mag", char: "🔍", tags: ["search"] },
  { shortcode: "bell", char: "🔔" },
  { shortcode: "speaker", char: "🔊" },
  { shortcode: "musical_note", char: "🎵" },
  { shortcode: "art", char: "🎨" },
  { shortcode: "camera", char: "📷" },
  { shortcode: "movie_camera", char: "🎥" },
  { shortcode: "tv", char: "📺" },
  { shortcode: "house", char: "🏠" },
  { shortcode: "car", char: "🚗" },
  { shortcode: "airplane", char: "✈️" },
  { shortcode: "bike", char: "🚴" },
  { shortcode: "soccer", char: "⚽" },
  { shortcode: "basketball", char: "🏀" },
  { shortcode: "trophy", char: "🏆" },
  { shortcode: "dart", char: "🎯", tags: ["target"] },
  { shortcode: "coffee", char: "☕" },
  { shortcode: "beer", char: "🍺" },
  { shortcode: "pizza", char: "🍕" },
  { shortcode: "hamburger", char: "🍔" },
  { shortcode: "cake", char: "🍰" },
  { shortcode: "apple", char: "🍎" },
  { shortcode: "dog", char: "🐶" },
  { shortcode: "cat", char: "🐱" },
  { shortcode: "fox", char: "🦊" },
  { shortcode: "bug", char: "🐛" },
  { shortcode: "butterfly", char: "🦋" },
  { shortcode: "tree", char: "🌳" },
  { shortcode: "flower", char: "🌸" },
  { shortcode: "rose", char: "🌹" },
  { shortcode: "money", char: "💰" },
  { shortcode: "credit_card", char: "💳" },
  { shortcode: "gem", char: "💎" },
  { shortcode: "ribbon", char: "🎀" },
  { shortcode: "gift", char: "🎁" },
  { shortcode: "balloon", char: "🎈" },
  { shortcode: "100", char: "💯" },
  { shortcode: "eyes", char: "👀" },
  { shortcode: "ghost", char: "👻" },
  { shortcode: "skull", char: "💀" },
  { shortcode: "robot", char: "🤖" },
  { shortcode: "alien", char: "👽" },
  { shortcode: "construction", char: "🚧" },
  { shortcode: "no_entry", char: "⛔" },
  { shortcode: "checkered_flag", char: "🏁" },
];

const EMOJI_INDEX = new Map(EMOJI_DB.map((e) => [e.shortcode, e]));

function findEmojiMatches(query: string, max = 8): Array<(typeof EMOJI_DB)[number]> {
  const q = query.toLowerCase();
  if (!q) return EMOJI_DB.slice(0, max);
  const prefix: Array<(typeof EMOJI_DB)[number]> = [];
  const tagged: Array<(typeof EMOJI_DB)[number]> = [];
  for (const e of EMOJI_DB) {
    if (e.shortcode.startsWith(q)) prefix.push(e);
    else if (e.tags?.some((t) => t.startsWith(q))) tagged.push(e);
    if (prefix.length >= max) break;
  }
  return [...prefix, ...tagged].slice(0, max);
}

class EmojiInlineView implements NodeView {
  dom: HTMLElement;

  constructor(node: Node) {
    this.dom = document.createElement("span");
    this.dom.className = "emoji";
    this.dom.contentEditable = "false";
    this.dom.setAttribute("data-shortcode", node.attrs.shortcode);
    this.dom.title = ":" + node.attrs.shortcode + ":";
    this.dom.textContent = node.attrs.char;
  }

  update(node: Node) {
    if (node.type.name !== "emoji") return false;
    this.dom.setAttribute("data-shortcode", node.attrs.shortcode);
    this.dom.title = ":" + node.attrs.shortcode + ":";
    this.dom.textContent = node.attrs.char;
    return true;
  }
}

export function buildEmojiNodeView() {
  return {
    emoji: (node: Node) => new EmojiInlineView(node),
  };
}

// Live conversion: text containing `:shortcode:` (where shortcode is in our
// index) collapses into an emoji atom node. Runs after-the-fact on
// completed shortcodes, so the user only ever sees the colon-form briefly.
export function buildLiveEmojiPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (transactions.some((tr) => tr.getMeta("liveEmoji") === true)) return null;

      const emojiType = schema.nodes.emoji;
      if (!emojiType) return null;

      const replacements: Array<{
        from: number;
        to: number;
        shortcode: string;
        char: string;
      }> = [];

      newState.doc.descendants((node, pos) => {
        if (node.type.name === "code_block" || node.type.name === "math_block") {
          return false;
        }
        if (!node.isText || !node.text) return;
        if (node.marks.some((m) => m.type.name === "code")) return;

        const re = /:([a-z0-9_+-]+):/gi;
        for (const match of node.text.matchAll(re)) {
          if (match.index === undefined) continue;
          const found = EMOJI_INDEX.get(match[1].toLowerCase());
          if (!found) continue;
          replacements.push({
            from: pos + match.index,
            to: pos + match.index + match[0].length,
            shortcode: found.shortcode,
            char: found.char,
          });
        }
      });

      if (replacements.length === 0) return null;
      replacements.sort((a, b) => b.from - a.from);

      const tr = newState.tr;
      tr.setMeta("liveEmoji", true);
      for (const r of replacements) {
        tr.replaceWith(
          r.from,
          r.to,
          emojiType.create({ shortcode: r.shortcode, char: r.char }),
        );
      }
      return tr;
    },
  });
}

// ---------- Autocomplete popup ----------

interface PopupActive {
  from: number;
  to: number;
  query: string;
  selectedIndex: number;
  results: Array<(typeof EMOJI_DB)[number]>;
}

interface PopupState {
  active: PopupActive | null;
}

export const emojiPopupKey = new PluginKey<PopupState>("emojiPopup");

function readPopupTrigger(state: ReturnType<typeof emojiPopupKey.getState>) {
  return state?.active ?? null;
}

function commitEmoji(
  view: EditorView,
  active: PopupActive,
  pick: (typeof EMOJI_DB)[number],
) {
  const { schema } = view.state;
  const emojiType = schema.nodes.emoji;
  if (!emojiType) return;
  const node = emojiType.create({ shortcode: pick.shortcode, char: pick.char });
  view.dispatch(
    view.state.tr
      .replaceWith(active.from, active.to, node)
      .scrollIntoView(),
  );
  view.focus();
}

class EmojiPopupView {
  private popup: HTMLElement;
  private editorView: EditorView;

  constructor(view: EditorView) {
    this.editorView = view;
    this.popup = document.createElement("div");
    this.popup.className = "emoji-popup";
    this.popup.style.display = "none";
    document.body.appendChild(this.popup);
    this.update(view);
  }

  update(view: EditorView) {
    const state = emojiPopupKey.getState(view.state);
    const active = readPopupTrigger(state);
    if (!active || active.results.length === 0) {
      this.popup.style.display = "none";
      this.popup.innerHTML = "";
      return;
    }

    let coords;
    try {
      coords = view.coordsAtPos(active.to);
    } catch {
      this.popup.style.display = "none";
      return;
    }
    this.popup.style.display = "block";
    this.popup.style.left = coords.left + "px";
    this.popup.style.top = coords.bottom + 4 + "px";

    this.popup.innerHTML = "";
    active.results.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "emoji-popup-item";
      if (i === active.selectedIndex) row.classList.add("selected");
      row.innerHTML =
        `<span class="emoji-popup-char">${item.char}</span>` +
        `<span class="emoji-popup-code">:${item.shortcode}:</span>`;
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        commitEmoji(this.editorView, active, item);
      });
      this.popup.appendChild(row);
    });
  }

  destroy() {
    this.popup.remove();
  }
}

export function buildEmojiPopupPlugin(): Plugin<PopupState> {
  return new Plugin<PopupState>({
    key: emojiPopupKey,
    state: {
      init: () => ({ active: null }),
      apply(tr, prev, _oldState, newState) {
        const explicit = tr.getMeta(emojiPopupKey) as
          | { type: "set"; active: PopupActive | null }
          | undefined;
        if (explicit) return { active: explicit.active };

        const sel = newState.selection;
        if (!(sel instanceof TextSelection) || !sel.empty) {
          return { active: null };
        }
        const $head = sel.$head;
        if (!$head.parent.isTextblock) return { active: null };
        if ($head.parent.type.name === "code_block" || $head.parent.type.name === "math_block") {
          return { active: null };
        }

        const before = $head.parent.textBetween(0, $head.parentOffset, undefined, "­");
        const m = /(?:^|\s):([a-z0-9_+-]{1,30})$/i.exec(before);
        if (!m) return { active: null };

        const query = m[1];
        const results = findEmojiMatches(query);
        if (results.length === 0) return { active: null };

        const fromOffset = $head.parentOffset - m[1].length - 1; // include `:`
        const blockStart = $head.start();
        const from = blockStart + fromOffset;
        const to = $head.pos;
        const prevSelected = prev.active?.selectedIndex ?? 0;
        const selectedIndex = Math.min(prevSelected, results.length - 1);
        return {
          active: { from, to, query, selectedIndex, results },
        };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const state = emojiPopupKey.getState(view.state);
        const active = readPopupTrigger(state);
        if (!active) return false;

        if (event.key === "Escape") {
          view.dispatch(
            view.state.tr.setMeta(emojiPopupKey, { type: "set", active: null }),
          );
          return true;
        }
        if (event.key === "ArrowDown") {
          const next = (active.selectedIndex + 1) % active.results.length;
          view.dispatch(
            view.state.tr.setMeta(emojiPopupKey, {
              type: "set",
              active: { ...active, selectedIndex: next },
            }),
          );
          return true;
        }
        if (event.key === "ArrowUp") {
          const next =
            (active.selectedIndex - 1 + active.results.length) % active.results.length;
          view.dispatch(
            view.state.tr.setMeta(emojiPopupKey, {
              type: "set",
              active: { ...active, selectedIndex: next },
            }),
          );
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const pick = active.results[active.selectedIndex];
          if (pick) {
            commitEmoji(view, active, pick);
            return true;
          }
        }
        return false;
      },
    },
    view(editorView) {
      return new EmojiPopupView(editorView);
    },
  });
}

// Helper: command to forcefully open the popup at the caret (for keymap
// triggers later if we want a Ctrl+; binding etc.)
export const triggerEmojiPopup: Command = (state, dispatch) => {
  if (!dispatch) return true;
  // Insert ":" so the input rule kicks in, leaving caret right after.
  dispatch(state.tr.insertText(":"));
  return true;
};
