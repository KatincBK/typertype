import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token.mjs";
import markdownitMark from "markdown-it-mark";
import markdownitSub from "markdown-it-sub";
import markdownitSup from "markdown-it-sup";
import { full as markdownitEmoji } from "markdown-it-emoji";
import markdownitFootnote from "markdown-it-footnote";
import katex from "katex";
import type { Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { schema } from "./schema";
import { mathInlineMarkdownItPlugin, mathMarkdownItPlugin } from "./math";
import { tocMarkdownItPlugin } from "./toc";
import { serializeTable } from "./tables";
import { applyInlineMarks } from "./liveFormat";

function listIsTight(tokens: readonly { type: string; hidden?: boolean }[], i: number): boolean {
  while (++i < tokens.length) {
    if (tokens[i].type !== "list_item_open") return !!tokens[i].hidden;
  }
  return false;
}

// FAZ 11 follow-up — Typora persists resized / aligned images as raw
// <img> tags inside markdown. With md.html=true those come through as
// `html_inline` tokens; we rewrite them to first-class `image` tokens so
// the existing image parser rule sees src/alt/title plus width/align.
const IMG_TAG_RE = /^<img\b([^>]*?)\/?>$/i;
const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_:.\-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=`]+))/g;

function parseHtmlImgAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

function buildImageToken(attrs: Record<string, string>): Token | null {
  if (!attrs.src) return null;
  const style = attrs.style || "";
  const zoom = style.match(/zoom\s*:\s*([^;]+?)\s*(;|$)/i)?.[1];
  const width = zoom?.trim() || attrs.width || null;
  let align: string | null = null;
  if (/float\s*:\s*left/i.test(style)) align = "left";
  else if (/float\s*:\s*right/i.test(style)) align = "right";
  else if (/margin\s*:\s*0\s*auto/i.test(style)) align = "center";
  else if (
    attrs.align === "left" ||
    attrs.align === "right" ||
    attrs.align === "center"
  )
    align = attrs.align;

  const imgTok = new Token("image", "img", 0);
  imgTok.attrs = [["src", attrs.src]];
  if (attrs.title) imgTok.attrs.push(["title", attrs.title]);
  if (width) imgTok.attrs.push(["width", width]);
  if (align) imgTok.attrs.push(["align", align]);
  const altTok = new Token("text", "", 0);
  altTok.content = attrs.alt || "";
  imgTok.children = [altTok];
  imgTok.content = attrs.alt || "";
  return imgTok;
}

function htmlImgPlugin(md: MarkdownIt) {
  md.core.ruler.after("inline", "html_img_to_image", (state) => {
    // Pass 1: html_inline within an inline token → swap to image token.
    for (const tok of state.tokens) {
      if (tok.type !== "inline" || !tok.children) continue;
      for (let i = 0; i < tok.children.length; i++) {
        const c = tok.children[i];
        if (c.type !== "html_inline") continue;
        const m = c.content.match(IMG_TAG_RE);
        if (!m) continue;
        const imgTok = buildImageToken(parseHtmlImgAttrs(m[1]));
        if (imgTok) tok.children[i] = imgTok;
      }
    }
    // Pass 2: top-level html_block containing only an <img> tag (this
    // is what markdown-it produces when the serializer round-trips an
    // aligned / sized image as the sole content of a paragraph). Wrap
    // it in paragraph_open/inline/paragraph_close so the parser sees a
    // normal inline image node.
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type !== "html_block") continue;
      const trimmed = tok.content.trim();
      const m = trimmed.match(IMG_TAG_RE);
      if (!m) continue;
      const imgTok = buildImageToken(parseHtmlImgAttrs(m[1]));
      if (!imgTok) continue;

      const open = new Token("paragraph_open", "p", 1);
      const inline = new Token("inline", "", 0);
      inline.children = [imgTok];
      inline.content = imgTok.content;
      const close = new Token("paragraph_close", "p", -1);
      tokens.splice(i, 1, open, inline, close);
      i += 2; // skip the tokens we just inserted
    }
  });
}

// Underline mark — the serializer writes `<u>...</u>` (no markdown
// equivalent), so parsing has to recognise the same shape. We rewrite
// `<u>` / `</u>` html_inline tokens into underline_open / _close pairs;
// the parser spec below handles them via the standard mark machinery.
const U_OPEN_RE = /^<u\b[^>]*>$/i;
const U_CLOSE_RE = /^<\/u\s*>$/i;

function underlinePlugin(md: MarkdownIt) {
  md.core.ruler.after("inline", "html_u_to_underline", (state) => {
    for (const tok of state.tokens) {
      if (tok.type !== "inline" || !tok.children) continue;
      for (let i = 0; i < tok.children.length; i++) {
        const c = tok.children[i];
        if (c.type !== "html_inline") continue;
        if (U_OPEN_RE.test(c.content)) {
          tok.children[i] = new Token("underline_open", "u", 1);
        } else if (U_CLOSE_RE.test(c.content)) {
          tok.children[i] = new Token("underline_close", "u", -1);
        }
      }
    }
  });
}

// FAZ 22 follow-up — table cells. The prosemirror-tables schema declares
// table_cell / table_header as `block+`, but markdown-it emits a bare
// `inline` token for cell content (no paragraph wrap). prosemirror-
// markdown silently drops inline-into-block insertions, leaving cells
// empty after a round-trip. We wrap each inline token between th/td
// open/close with paragraph_open / paragraph_close so the parser sees
// the well-formed shape the schema expects.
function wrapTableCellsPlugin(md: MarkdownIt) {
  md.core.ruler.after("inline", "wrap_table_cell_inline", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type !== "th_open" && tok.type !== "td_open") continue;
      // Walk forward to the matching close, wrapping any inline we
      // encounter. There's normally only one inline per cell, but
      // protecting against zero or multiple costs nothing.
      const closeType = tok.type === "th_open" ? "th_close" : "td_close";
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === closeType) break;
        if (tokens[j].type !== "inline") continue;
        const open = new Token("paragraph_open", "p", 1);
        open.hidden = true; // tight: don't emit a blank line on render
        const close = new Token("paragraph_close", "p", -1);
        close.hidden = true;
        tokens.splice(j, 0, open);
        tokens.splice(j + 2, 0, close);
        j += 2;
      }
    }
  });
}

// Editor-parse model (Typora-style): markdown inline markers stay in the
// document as literal text — liveFormat re-derives the marks from them. So
// the parsing markdown-it instance has every inline-formatting rule turned
// OFF: `**x**`, `` `x` ``, `~~x~~`, `==x==`, `~x~`, `^x^` all flow through as
// plain `text` tokens. `<u>` / `</u>` (and any stray inline HTML) become
// literal text too. Inline `$...$` math is *also* literal — mathDecorations
// renders it from the raw text. `link`, `image`, emoji, math_block,
// footnote, table, [toc] stay first-class.
function htmlInlineToTextPlugin(md: MarkdownIt) {
  md.core.ruler.after("inline", "html_inline_to_text", (state) => {
    for (const tok of state.tokens) {
      if (tok.type !== "inline" || !tok.children) continue;
      for (const c of tok.children) {
        if (c.type === "html_inline") c.type = "text";
      }
    }
  });
}

const mdParse = MarkdownIt({ html: true })
  .use(markdownitEmoji)
  .use(markdownitFootnote)
  .use(mathMarkdownItPlugin)
  .use(tocMarkdownItPlugin)
  .use(htmlImgPlugin)
  .use(wrapTableCellsPlugin)
  .use(htmlInlineToTextPlugin)
  .disable(["emphasis", "strikethrough", "backticks"]);

// Render model — full markdown-it, used by the HTML export path
// (`markdownItInstance` below). Inline formatting rules stay ON here so
// `md.render(markdown)` still produces `<strong>`, `<code>`, `<mark>`, etc.
const md = MarkdownIt({ html: true })
  .use(markdownitMark)
  .use(markdownitSub)
  .use(markdownitSup)
  .use(markdownitEmoji)
  .use(markdownitFootnote)
  .use(mathInlineMarkdownItPlugin)
  .use(mathMarkdownItPlugin)
  .use(tocMarkdownItPlugin)
  .use(htmlImgPlugin)
  .use(wrapTableCellsPlugin)
  .use(underlinePlugin);

// MVP-7 — render rules for HTML export. The editor side uses md.parse()
// and feeds tokens into prosemirror-markdown, so adding renderer.rules is
// safe (it only affects md.render() callers — i.e. the export path).
md.renderer.rules.math_inline = (tokens, idx) => {
  const tex = tokens[idx].content;
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return `<span class="math-inline">$${escapeHtml(tex)}$</span>`;
  }
};

md.renderer.rules.math_block = (tokens, idx) => {
  const tex = tokens[idx].content;
  try {
    return `<div class="math-block">${katex.renderToString(tex, {
      throwOnError: false,
      displayMode: true,
    })}</div>`;
  } catch {
    return `<div class="math-block">$$${escapeHtml(tex)}$$</div>`;
  }
};

md.renderer.rules.toc = () =>
  `<div class="toc"><em>İçindekiler (export'te işlenmez)</em></div>`;

// Override the default fence renderer so ```mermaid blocks become a
// <div class="mermaid"> the bundled mermaid.js can pick up on page load.
const defaultFenceRule = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
  const token = tokens[idx];
  if (token.info.trim() === "mermaid") {
    return `<div class="mermaid">${escapeHtml(token.content)}</div>\n`;
  }
  return defaultFenceRule
    ? defaultFenceRule(tokens, idx, options, env, slf)
    : slf.renderToken(tokens, idx, options);
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Re-exported so the export module can call md.render(markdown) without
// having to rebuild the full plugin chain.
export const markdownItInstance = md;

const parser = new MarkdownParser(schema, mdParse, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: {
    block: "bullet_list",
    getAttrs: (_, tokens, i) => ({ tight: listIsTight(tokens, i) }),
  },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (tok, tokens, i) => ({
      order: +(tok.attrGet("start") ?? "1") || 1,
      tight: listIsTight(tokens, i),
    }),
  },
  heading: {
    block: "heading",
    getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
  },
  code_block: { block: "code_block", noCloseToken: true },
  fence: {
    block: "code_block",
    getAttrs: (tok) => ({ params: tok.info || "" }),
    noCloseToken: true,
  },
  hr: { node: "horizontal_rule" },
  image: {
    node: "image",
    getAttrs: (tok) => ({
      src: tok.attrGet("src") ?? "",
      title: tok.attrGet("title") ?? null,
      alt: tok.children?.[0]?.content ?? null,
      width: tok.attrGet("width") ?? null,
      align: tok.attrGet("align") ?? null,
    }),
  },
  hardbreak: { node: "hard_break" },
  math_block: { block: "math_block", noCloseToken: true },
  emoji: {
    node: "emoji",
    getAttrs: (tok) => ({
      shortcode: tok.markup || "",
      char: tok.content || "",
    }),
  },
  toc: { node: "toc" },
  // markdown-it-footnote stores the original label (e.g. "1", "typora") in
  // tok.meta.label and a numeric index in tok.meta.id. We round-trip the
  // user-visible label so source like `[^typora]` survives a save cycle.
  footnote_ref: {
    node: "footnote_ref",
    getAttrs: (tok) => ({
      id:
        tok.meta?.label ??
        tok.meta?.id?.toString() ??
        tok.content ??
        "",
    }),
  },
  footnote: {
    block: "footnote_def",
    getAttrs: (tok) => ({
      id: tok.meta?.label ?? tok.meta?.id?.toString() ?? "",
    }),
  },
  // footnote_anchor is a single inline token (the ↩ back-link), so we
  // need noCloseToken: true alongside ignore — without it, the parser
  // would try to register footnote_anchor_open / _close handlers and
  // bail at runtime when it sees the bare token.
  footnote_anchor: { ignore: true, noCloseToken: true },
  footnote_block: { ignore: true },
  // GFM table support
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "table_row" },
  th: {
    block: "table_header",
    getAttrs: (tok) => ({
      colspan: 1,
      rowspan: 1,
      colwidth: null,
      align: tok.attrGet("style")?.match(/text-align:\s*(\w+)/)?.[1] ?? null,
    }),
  },
  td: {
    block: "table_cell",
    getAttrs: (tok) => ({
      colspan: 1,
      rowspan: 1,
      colwidth: null,
      align: tok.attrGet("style")?.match(/text-align:\s*(\w+)/)?.[1] ?? null,
    }),
  },
  // Inline-formatting marks (em / strong / code / s / mark / sub / sup /
  // underline) are no longer produced by the parser — `mdParse` leaves their
  // markers as literal text and liveFormat derives the marks. `link` stays
  // on the old consumed-marker model until Faz D.
  link: {
    mark: "link",
    getAttrs: (tok) => ({
      href: tok.attrGet("href") ?? "",
      title: tok.attrGet("title") ?? null,
    }),
  },
});

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Inline-formatting marks now serialise to nothing — the `**` `*` `~~` `==`
// `` ` `` `~` `^` `<u>` characters are literal text in the document.
const EMPTY_MARK = {
  open: "",
  close: "",
  mixable: true,
  expelEnclosingWhitespace: false,
};

const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    // Inline text IS the markdown source now — emit it verbatim so `**`, `~~`,
    // `` ` ``, `<u>` round-trip untouched. (Known limitation: a paragraph whose
    // text literally starts with a block char like `#`/`>`/`-` is no longer
    // escaped — revisited in a later phase.)
    text: (state, node) => {
      state.text(node.text || "", false);
    },
    image: (state, node) => {
      const { src, alt, title, width, align } = node.attrs as {
        src: string;
        alt: string | null;
        title: string | null;
        width: string | null;
        align: "left" | "right" | "center" | null;
      };
      // No width / align → classic markdown form so plain consumers see
      // a normal image. Anything fancier round-trips through HTML, which
      // is what Typora writes too.
      if (!width && !align) {
        state.write(
          "![" +
            state.esc(alt || "") +
            "](" +
            state.esc(src) +
            (title ? ` ${JSON.stringify(title)}` : "") +
            ")",
        );
        return;
      }
      const parts = [`src="${escapeHtmlAttr(src)}"`];
      if (alt) parts.push(`alt="${escapeHtmlAttr(alt)}"`);
      if (title) parts.push(`title="${escapeHtmlAttr(title)}"`);
      const styles: string[] = [];
      if (width) styles.push(`zoom: ${width}`);
      if (align === "left") styles.push("float: left");
      else if (align === "right") styles.push("float: right");
      else if (align === "center") styles.push("display: block; margin: 0 auto");
      if (styles.length) parts.push(`style="${escapeHtmlAttr(styles.join("; "))};"`);
      state.write(`<img ${parts.join(" ")} />`);
    },
    math_block: (state, node) => {
      state.write("$$\n" + node.textContent + "\n$$");
      state.closeBlock(node);
    },
    emoji: (state, node) => {
      // Round-trip the original :shortcode: form so the source stays stable
      if (node.attrs.shortcode) {
        state.write(":" + node.attrs.shortcode + ":");
      } else {
        state.write(node.attrs.char || "");
      }
    },
    toc: (state, node) => {
      state.write("[toc]");
      state.closeBlock(node);
    },
    footnote_ref: (state, node) => {
      state.write("[^" + node.attrs.id + "]");
    },
    footnote_def: (state, node) => {
      state.write("[^" + node.attrs.id + "]: ");
      // Schema guarantees footnote_def has block+ content. We render only
      // the first textblock inline; multi-block defs collapse to their
      // first paragraph (rare in practice). Avoids calling renderInline on
      // a non-textblock parent which would throw.
      const first = node.firstChild;
      if (first?.isTextblock) {
        state.renderInline(first);
      }
      state.closeBlock(node);
    },
    table: (state, node) => {
      state.write(serializeTable(node, state));
      state.closeBlock(node);
    },
    table_row: () => {
      // Cells are emitted via serializeTable; this entry is just to satisfy
      // the serializer when prosemirror walks descendants.
    },
    table_cell: () => {},
    table_header: () => {},
  },
  {
    // `link` keeps the old consumed-marker model (Faz D migrates it).
    link: defaultMarkdownSerializer.marks.link,
    em: EMPTY_MARK,
    strong: EMPTY_MARK,
    code: EMPTY_MARK,
    strikethrough: EMPTY_MARK,
    highlight: EMPTY_MARK,
    subscript: EMPTY_MARK,
    superscript: EMPTY_MARK,
    underline: EMPTY_MARK,
    markup: EMPTY_MARK,
  },
);

export function markdownToDoc(markdown: string): Node {
  const parsed = parser.parse(markdown);
  if (!parsed) {
    throw new Error("Failed to parse markdown");
  }
  // The parser leaves inline markers as literal text; derive the style +
  // `markup` marks once so a freshly loaded file renders formatted (the
  // liveFormat plugin only fires on subsequent edits).
  const tr = EditorState.create({ doc: parsed }).tr;
  applyInlineMarks(tr, schema);
  return tr.doc;
}

export function docToMarkdown(doc: Node): string {
  return serializer.serialize(doc);
}
