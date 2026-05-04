import { keymap } from "prosemirror-keymap";
import {
  chainCommands,
  lift,
  setBlockType,
  toggleMark,
  wrapIn,
} from "prosemirror-commands";
import { redo, undo } from "prosemirror-history";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
  wrapInList,
} from "prosemirror-schema-list";
import { undoInputRule } from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { blockTransformEnter, codeBlockExitOnEmptyLine } from "./blockEnter";
import { backspaceEmptyPair } from "./autoPair";
import {
  clearFormat,
  copyAsMarkdown,
  decreaseHeadingLevel,
  increaseHeadingLevel,
  insertLink,
  jumpToSelection,
  pasteAsPlainText,
  selectLine,
  selectStyleScope,
  selectWord,
  softBreak,
} from "./commands";

export function buildKeymap(schema: Schema) {
  const keys: Record<string, Command> = {};

  // History
  keys["Mod-z"] = undo;
  keys["Shift-Mod-z"] = redo;
  keys["Mod-y"] = redo;
  keys["Backspace"] = chainCommands(undoInputRule, backspaceEmptyPair);

  // Inline marks
  if (schema.marks.strong) keys["Mod-b"] = toggleMark(schema.marks.strong);
  if (schema.marks.em) keys["Mod-i"] = toggleMark(schema.marks.em);
  if (schema.marks.code) keys["Mod-Shift-`"] = toggleMark(schema.marks.code);
  if (schema.marks.underline) keys["Mod-u"] = toggleMark(schema.marks.underline);
  if (schema.marks.strikethrough) {
    keys["Alt-Shift-5"] = toggleMark(schema.marks.strikethrough);
  }
  if (schema.marks.link) keys["Mod-k"] = insertLink(schema);

  // Headings
  if (schema.nodes.heading) {
    for (let level = 1; level <= 6; level++) {
      keys[`Mod-${level}`] = setBlockType(schema.nodes.heading, { level });
    }
    keys["Mod-="] = increaseHeadingLevel(schema);
    keys["Mod--"] = decreaseHeadingLevel(schema);
  }
  if (schema.nodes.paragraph) {
    keys["Mod-0"] = setBlockType(schema.nodes.paragraph);
  }

  // Block wrappers
  if (schema.nodes.blockquote) {
    keys["Mod-Shift-q"] = wrapIn(schema.nodes.blockquote);
  }
  if (schema.nodes.code_block) {
    keys["Mod-Shift-k"] = setBlockType(schema.nodes.code_block);
  }
  if (schema.nodes.bullet_list) {
    keys["Mod-Shift-]"] = wrapInList(schema.nodes.bullet_list);
  }
  if (schema.nodes.ordered_list) {
    keys["Mod-Shift-["] = wrapInList(schema.nodes.ordered_list);
  }

  // Selection
  keys["Mod-l"] = selectLine;
  keys["Mod-d"] = selectWord;
  keys["Mod-e"] = selectStyleScope;
  keys["Mod-j"] = jumpToSelection;

  // Clipboard
  keys["Mod-Shift-c"] = copyAsMarkdown(schema);
  keys["Mod-Shift-v"] = pasteAsPlainText;

  // Format
  keys["Mod-\\"] = clearFormat(schema);

  // Soft break
  keys["Shift-Enter"] = softBreak(schema);

  // Indent / Outdent (Mod-[ = indent, Mod-] = outdent — CONTROLS.md)
  if (schema.nodes.list_item) {
    keys["Mod-["] = sinkListItem(schema.nodes.list_item);
    keys["Mod-]"] = chainCommands(liftListItem(schema.nodes.list_item), lift);
  } else {
    keys["Mod-]"] = lift;
  }

  // Enter chain (Adım 3)
  const enterChain: Command[] = [
    codeBlockExitOnEmptyLine(schema),
    blockTransformEnter(schema),
  ];
  if (schema.nodes.list_item) {
    enterChain.push(splitListItem(schema.nodes.list_item));
    keys["Tab"] = sinkListItem(schema.nodes.list_item);
    keys["Shift-Tab"] = liftListItem(schema.nodes.list_item);
  }
  keys["Enter"] = chainCommands(...enterChain);

  return keymap(keys);
}
