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
import { schema } from "./schema";
import { mathMarkdownItPlugin } from "./math";
import { tocMarkdownItPlugin } from "./toc";
import { serializeTable } from "./tables";

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

function htmlImgPlugin(md: MarkdownIt) {
  md.core.ruler.after("inline", "html_img_to_image", (state) => {
    for (const tok of state.tokens) {
      if (tok.type !== "inline" || !tok.children) continue;
      for (let i = 0; i < tok.children.length; i++) {
        const c = tok.children[i];
        if (c.type !== "html_inline") continue;
        const m = c.content.match(IMG_TAG_RE);
        if (!m) continue;
        const attrs = parseHtmlImgAttrs(m[1]);
        if (!attrs.src) continue;
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
        tok.children[i] = imgTok;
      }
    }
  });
}

const md = MarkdownIt({ html: true })
  .use(markdownitMark)
  .use(markdownitSub)
  .use(markdownitSup)
  .use(markdownitEmoji)
  .use(markdownitFootnote)
  .use(mathMarkdownItPlugin)
  .use(tocMarkdownItPlugin)
  .use(htmlImgPlugin);

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

const parser = new MarkdownParser(schema, md, {
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
  math_inline: {
    node: "math_inline",
    getAttrs: (tok) => ({ tex: tok.content }),
  },
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
  em: { mark: "em" },
  strong: { mark: "strong" },
  link: {
    mark: "link",
    getAttrs: (tok) => ({
      href: tok.attrGet("href") ?? "",
      title: tok.attrGet("title") ?? null,
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
  s: { mark: "strikethrough" },
  mark: { mark: "highlight" },
  sub: { mark: "subscript" },
  sup: { mark: "superscript" },
});

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
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
    math_inline: (state, node) => {
      state.write("$" + node.attrs.tex + "$");
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
      state.write(serializeTable(node));
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
    ...defaultMarkdownSerializer.marks,
    strikethrough: {
      open: "~~",
      close: "~~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    highlight: {
      open: "==",
      close: "==",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    subscript: {
      open: "~",
      close: "~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    superscript: {
      open: "^",
      close: "^",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    underline: {
      open: "<u>",
      close: "</u>",
      mixable: false,
      expelEnclosingWhitespace: true,
    },
  },
);

export function markdownToDoc(markdown: string): Node {
  const parsed = parser.parse(markdown);
  if (!parsed) {
    throw new Error("Failed to parse markdown");
  }
  return parsed;
}

export function docToMarkdown(doc: Node): string {
  return serializer.serialize(doc);
}
