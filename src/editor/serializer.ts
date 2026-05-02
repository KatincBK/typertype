import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import MarkdownIt from "markdown-it";
import markdownitMark from "markdown-it-mark";
import markdownitSub from "markdown-it-sub";
import markdownitSup from "markdown-it-sup";
import type { Node } from "prosemirror-model";
import { schema } from "./schema";

function listIsTight(tokens: readonly { type: string; hidden?: boolean }[], i: number): boolean {
  while (++i < tokens.length) {
    if (tokens[i].type !== "list_item_open") return !!tokens[i].hidden;
  }
  return false;
}

const md = MarkdownIt({ html: true })
  .use(markdownitMark)
  .use(markdownitSub)
  .use(markdownitSup);

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

const serializer = new MarkdownSerializer(defaultMarkdownSerializer.nodes, {
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
});

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
