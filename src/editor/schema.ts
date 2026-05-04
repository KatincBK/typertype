import { Schema } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-markdown";
import { mathBlockSpec, mathInlineSpec } from "./math";
import { emojiNodeSpec } from "./emoji";
import { tocNodeSpec } from "./toc";
import { footnoteDefSpec, footnoteRefSpec } from "./footnote";
import { tableNodeSpecMap } from "./tables";

const nodes = baseSchema.spec.nodes
  .addToEnd("math_inline", mathInlineSpec)
  .addToEnd("math_block", mathBlockSpec)
  .addToEnd("emoji", emojiNodeSpec)
  .addToEnd("toc", tocNodeSpec)
  .addToEnd("footnote_ref", footnoteRefSpec)
  .addToEnd("footnote_def", footnoteDefSpec)
  .addToEnd("table", tableNodeSpecMap.table)
  .addToEnd("table_row", tableNodeSpecMap.table_row)
  .addToEnd("table_cell", tableNodeSpecMap.table_cell)
  .addToEnd("table_header", tableNodeSpecMap.table_header);

export const schema = new Schema({
  nodes,
  marks: baseSchema.spec.marks
    .addToEnd("strikethrough", {
      parseDOM: [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        { style: "text-decoration=line-through" },
      ],
      toDOM() {
        return ["s", 0];
      },
    })
    .addToEnd("highlight", {
      parseDOM: [{ tag: "mark" }],
      toDOM() {
        return ["mark", 0];
      },
    })
    .addToEnd("subscript", {
      parseDOM: [{ tag: "sub" }],
      toDOM() {
        return ["sub", 0];
      },
      excludes: "superscript",
    })
    .addToEnd("superscript", {
      parseDOM: [{ tag: "sup" }],
      toDOM() {
        return ["sup", 0];
      },
      excludes: "subscript",
    })
    .addToEnd("underline", {
      parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
      toDOM() {
        return ["u", 0];
      },
    }),
});
