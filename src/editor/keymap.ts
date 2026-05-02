import { keymap } from "prosemirror-keymap";
import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
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

export function buildKeymap(schema: Schema) {
  const keys: Record<string, Command> = {};

  keys["Mod-z"] = undo;
  keys["Shift-Mod-z"] = redo;
  keys["Mod-y"] = redo;
  keys["Backspace"] = undoInputRule;

  if (schema.marks.strong) keys["Mod-b"] = toggleMark(schema.marks.strong);
  if (schema.marks.em) keys["Mod-i"] = toggleMark(schema.marks.em);
  if (schema.marks.code) keys["Mod-`"] = toggleMark(schema.marks.code);

  if (schema.nodes.heading) {
    for (let level = 1; level <= 6; level++) {
      keys[`Mod-${level}`] = setBlockType(schema.nodes.heading, { level });
    }
  }
  if (schema.nodes.paragraph) {
    keys["Mod-0"] = setBlockType(schema.nodes.paragraph);
  }

  if (schema.nodes.blockquote) {
    keys["Mod-Shift-q"] = wrapIn(schema.nodes.blockquote);
  }
  if (schema.nodes.bullet_list) {
    keys["Mod-Shift-8"] = wrapInList(schema.nodes.bullet_list);
  }
  if (schema.nodes.ordered_list) {
    keys["Mod-Shift-7"] = wrapInList(schema.nodes.ordered_list);
  }

  if (schema.nodes.list_item) {
    keys["Enter"] = splitListItem(schema.nodes.list_item);
    keys["Tab"] = sinkListItem(schema.nodes.list_item);
    keys["Shift-Tab"] = liftListItem(schema.nodes.list_item);
  }

  return keymap(keys);
}
