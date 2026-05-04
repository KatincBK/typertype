import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import MarkdownIt from "markdown-it";
import markdownitMark from "markdown-it-mark";
import markdownitSub from "markdown-it-sub";
import markdownitSup from "markdown-it-sup";
import { full as markdownitEmoji } from "markdown-it-emoji";
import markdownitFootnote from "markdown-it-footnote";
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

const md = MarkdownIt({ html: true })
  .use(markdownitMark)
  .use(markdownitSub)
  .use(markdownitSup)
  .use(markdownitEmoji)
  .use(markdownitFootnote)
  .use(mathMarkdownItPlugin)
  .use(tocMarkdownItPlugin);

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
  footnote_anchor: { ignore: true },
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

const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
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
