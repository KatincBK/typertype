import { Schema } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-markdown";

export const schema = new Schema({
  nodes: baseSchema.spec.nodes,
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
