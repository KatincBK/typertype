import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import type { Node } from "prosemirror-model";

export function markdownToDoc(markdown: string): Node {
  const parsed = defaultMarkdownParser.parse(markdown);
  if (!parsed) {
    throw new Error("Failed to parse markdown");
  }
  return parsed;
}

export function docToMarkdown(doc: Node): string {
  return defaultMarkdownSerializer.serialize(doc);
}
