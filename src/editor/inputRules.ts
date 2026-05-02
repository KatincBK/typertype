import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
  smartQuotes,
  emDash,
  ellipsis,
} from "prosemirror-inputrules";
import type { MarkType, NodeType, Schema } from "prosemirror-model";
import { logger } from "@/lib/logger";

function headingRule(nodeType: NodeType, maxLevel: number) {
  return textblockTypeInputRule(
    new RegExp("^(#{1," + maxLevel + "})\\s$"),
    nodeType,
    (match) => ({ level: match[1].length }),
  );
}

function blockQuoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType);
}

function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    (match) => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order === +match[1],
  );
}

function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType);
}

function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType);
}

function markInputRule(regexp: RegExp, markType: MarkType): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const captured = match[1];
    if (!captured) return null;
    const tr = state.tr;
    const textStart = start + match[0].indexOf(captured);
    const textEnd = textStart + captured.length;
    if (textEnd < end) tr.delete(textEnd, end);
    if (textStart > start) tr.delete(start, textStart);
    const finalEnd = start + captured.length;
    tr.addMark(start, finalEnd, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}

function strongRule(markType: MarkType) {
  return markInputRule(/\*\*([^*]+)\*\*$/, markType);
}

function emRule(markType: MarkType) {
  return markInputRule(/(?<!\*)\*([^*\s][^*]*[^*\s]|[^*\s])\*$/, markType);
}

function codeMarkRule(markType: MarkType) {
  return markInputRule(/`([^`]+)`$/, markType);
}

export function buildInputRules(schema: Schema) {
  const rules = [...smartQuotes, ellipsis, emDash];
  if (schema.nodes.blockquote) rules.push(blockQuoteRule(schema.nodes.blockquote));
  if (schema.nodes.ordered_list) rules.push(orderedListRule(schema.nodes.ordered_list));
  if (schema.nodes.bullet_list) rules.push(bulletListRule(schema.nodes.bullet_list));
  if (schema.nodes.code_block) rules.push(codeBlockRule(schema.nodes.code_block));
  if (schema.nodes.heading) rules.push(headingRule(schema.nodes.heading, 6));
  if (schema.marks.strong) rules.push(strongRule(schema.marks.strong));
  if (schema.marks.em) rules.push(emRule(schema.marks.em));
  if (schema.marks.code) rules.push(codeMarkRule(schema.marks.code));

  logger.info(
    `[InputRules] ${rules.length} rules built. Nodes: [${Object.keys(schema.nodes).join(", ")}]. Marks: [${Object.keys(schema.marks).join(", ")}].`,
  );

  return inputRules({ rules });
}
