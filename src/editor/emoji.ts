import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

// Adım 7 (Faz F'de yeniden yazıldı) — Emoji.
//
// Emoji is no longer a node. The literal `:shortcode:` text lives in the
// document; `emojiDecorations` renders the unicode glyph over it (Typora-
// style source reveal). This file owns the data (EMOJI_DB / EMOJI_INDEX)
// plus the autocomplete popup that drops the colon form into the doc.

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

export const EMOJI_INDEX = new Map(EMOJI_DB.map((e) => [e.shortcode, e]));

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
  // Drop the literal `:shortcode:` source into the doc — emojiDecorations
  // will render the unicode glyph over it as soon as the caret moves out.
  const text = ":" + pick.shortcode + ":";
  const tr = view.state.tr.insertText(text, active.from, active.to);
  // Park the caret at the end of the inserted source so the run renders
  // immediately (the run is "active" while the caret is strictly inside).
  const end = active.from + text.length;
  tr.setSelection(TextSelection.create(tr.doc, end));
  tr.scrollIntoView();
  view.dispatch(tr);
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

        // Use a 1-char placeholder for non-text leaves so parentOffset and
        // string positions stay aligned. Trigger after any non-alphanumeric
        // boundary (start, whitespace, punctuation, the `­` placeholder
        // itself) so a `:` typed right after another emoji or bracket also
        // opens the popup.
        const before = $head.parent.textBetween(0, $head.parentOffset, undefined, "­");
        const m = /(?:^|[^A-Za-z0-9]):([a-z0-9_+-]{1,30})$/i.exec(before);
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

// Helper: command to forcefully open the popup at the caret.
export const triggerEmojiPopup: Command = (state, dispatch) => {
  if (!dispatch) return true;
  // Insert ":" so the input rule kicks in, leaving caret right after.
  dispatch(state.tr.insertText(":"));
  return true;
};
