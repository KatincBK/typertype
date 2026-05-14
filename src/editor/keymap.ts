import { keymap } from "prosemirror-keymap";
import {
  chainCommands,
  lift,
  setBlockType,
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
  toggleMarker,
} from "./commands";
import { insertTable, tableKeyboardCommands } from "./tables";
import { logger } from "@/lib/logger";

// Map a stable, user-facing command name to its concrete Command. Adım 13's
// custom keymap config refers to commands by these names so the JSON file
// stays portable across releases — internal renames don't break user
// configs.
function buildCommandRegistry(schema: Schema): Record<string, Command> {
  const registry: Record<string, Command> = {
    undo,
    redo,
    softBreak: softBreak(schema),
    selectLine,
    selectWord,
    selectStyleScope,
    jumpToSelection,
    copyAsMarkdown: copyAsMarkdown(schema),
    pasteAsPlainText,
    clearFormat: clearFormat(schema),
    insertLink: insertLink(schema),
    increaseHeadingLevel: increaseHeadingLevel(schema),
    decreaseHeadingLevel: decreaseHeadingLevel(schema),
    nextCell: tableKeyboardCommands.goToNextCell,
    prevCell: tableKeyboardCommands.goToPrevCell,
    insertTable: insertTable(schema),
  };
  // Literal-marker model — these edit the marker TEXT; liveFormat re-derives
  // the mark. Registry names are unchanged so custom keymap configs still work.
  if (schema.marks.strong) {
    registry.toggleStrong = toggleMarker("strong", "**", "**");
  }
  if (schema.marks.em) registry.toggleEmphasis = toggleMarker("em", "*", "*");
  if (schema.marks.code) registry.toggleCode = toggleMarker("code", "`", "`");
  if (schema.marks.underline) {
    registry.toggleUnderline = toggleMarker("underline", "<u>", "</u>");
  }
  if (schema.marks.strikethrough) {
    registry.toggleStrikethrough = toggleMarker("strikethrough", "~~", "~~");
  }
  if (schema.nodes.heading) {
    for (let level = 1; level <= 6; level++) {
      registry[`heading${level}`] = setBlockType(schema.nodes.heading, { level });
    }
  }
  if (schema.nodes.paragraph) registry.paragraph = setBlockType(schema.nodes.paragraph);
  if (schema.nodes.blockquote) registry.blockquote = wrapIn(schema.nodes.blockquote);
  if (schema.nodes.code_block) registry.codeFence = setBlockType(schema.nodes.code_block);
  if (schema.nodes.math_block) {
    registry.mathBlock = (state, dispatch) => {
      if (dispatch) {
        const mb = schema.nodes.math_block.create();
        dispatch(state.tr.replaceSelectionWith(mb).scrollIntoView());
      }
      return true;
    };
  }
  if (schema.nodes.bullet_list) registry.bulletList = wrapInList(schema.nodes.bullet_list);
  if (schema.nodes.ordered_list) registry.orderedList = wrapInList(schema.nodes.ordered_list);
  return registry;
}

export function buildKeymap(schema: Schema, overrides: Record<string, string> = {}) {
  const keys: Record<string, Command> = {};
  const registry = buildCommandRegistry(schema);

  // History
  keys["Mod-z"] = registry.undo;
  keys["Shift-Mod-z"] = registry.redo;
  keys["Mod-y"] = registry.redo;
  keys["Backspace"] = chainCommands(undoInputRule, backspaceEmptyPair);

  // Inline marks
  if (registry.toggleStrong) keys["Mod-b"] = registry.toggleStrong;
  if (registry.toggleEmphasis) keys["Mod-i"] = registry.toggleEmphasis;
  if (registry.toggleCode) keys["Mod-Shift-`"] = registry.toggleCode;
  if (registry.toggleUnderline) keys["Mod-u"] = registry.toggleUnderline;
  if (registry.toggleStrikethrough) keys["Alt-Shift-5"] = registry.toggleStrikethrough;
  keys["Mod-k"] = registry.insertLink;

  // Headings
  for (let level = 1; level <= 6; level++) {
    if (registry[`heading${level}`]) keys[`Mod-${level}`] = registry[`heading${level}`];
  }
  if (registry.paragraph) keys["Mod-0"] = registry.paragraph;
  if (registry.increaseHeadingLevel) keys["Mod-="] = registry.increaseHeadingLevel;
  if (registry.decreaseHeadingLevel) keys["Mod--"] = registry.decreaseHeadingLevel;

  // Block wrappers
  if (registry.blockquote) keys["Mod-Shift-q"] = registry.blockquote;
  if (registry.codeFence) keys["Mod-Shift-k"] = registry.codeFence;
  if (registry.mathBlock) keys["Mod-Shift-m"] = registry.mathBlock;
  if (registry.bulletList) keys["Mod-Shift-]"] = registry.bulletList;
  if (registry.orderedList) keys["Mod-Shift-["] = registry.orderedList;
  keys["Mod-t"] = registry.insertTable;

  // Selection
  keys["Mod-l"] = registry.selectLine;
  keys["Mod-d"] = registry.selectWord;
  keys["Mod-e"] = registry.selectStyleScope;
  keys["Mod-j"] = registry.jumpToSelection;

  // Clipboard
  keys["Mod-Shift-c"] = registry.copyAsMarkdown;
  keys["Mod-Shift-v"] = registry.pasteAsPlainText;

  // Format
  keys["Mod-\\"] = registry.clearFormat;

  // Soft break
  keys["Shift-Enter"] = registry.softBreak;

  // Indent / Outdent (Mod-[ = indent, Mod-] = outdent — CONTROLS.md)
  if (schema.nodes.list_item) {
    keys["Mod-["] = sinkListItem(schema.nodes.list_item);
    keys["Mod-]"] = chainCommands(liftListItem(schema.nodes.list_item), lift);
  } else {
    keys["Mod-]"] = lift;
  }

  // Enter chain (Adım 3) + Tab cell navigation in tables
  const enterChain: Command[] = [
    codeBlockExitOnEmptyLine(schema),
    blockTransformEnter(schema),
  ];
  const tabChain: Command[] = [registry.nextCell];
  const shiftTabChain: Command[] = [registry.prevCell];
  if (schema.nodes.list_item) {
    enterChain.push(splitListItem(schema.nodes.list_item));
    tabChain.push(sinkListItem(schema.nodes.list_item));
    shiftTabChain.push(liftListItem(schema.nodes.list_item));
  }
  keys["Enter"] = chainCommands(...enterChain);
  keys["Tab"] = chainCommands(...tabChain);
  keys["Shift-Tab"] = chainCommands(...shiftTabChain);

  // Apply user overrides last so they win on conflict.
  for (const [shortcut, commandName] of Object.entries(overrides)) {
    const cmd = registry[commandName];
    if (!cmd) {
      logger.warn(
        "Unknown command in user keymap override:",
        commandName,
        "for shortcut",
        shortcut,
      );
      continue;
    }
    keys[shortcut] = cmd;
  }

  return keymap(keys);
}
