import { Schema, type NodeSpec } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-markdown";
import { mathBlockSpec } from "./math";
import { tocNodeSpec } from "./toc";
import { footnoteDefSpec, footnoteRefSpec } from "./footnote";
import { tableNodeSpecMap } from "./tables";

// FAZ 11 follow-up — extend the base image node with `width` (e.g. "60%"
// or "320px") and `align` (left/center/right). When either is set the
// serializer round-trips through an HTML <img> tag, matching the way
// Typora persists resized / aligned images. Plain markdown images keep
// the classic ![alt](src) form.
const imageSpec: NodeSpec = {
  inline: true,
  attrs: {
    src: { default: "" },
    alt: { default: null },
    title: { default: null },
    width: { default: null },
    align: { default: null },
  },
  group: "inline",
  draggable: true,
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs(dom) {
        const el = dom as HTMLImageElement;
        const style = el.getAttribute("style") || "";
        const zoom = style.match(/zoom\s*:\s*([^;]+?)\s*(;|$)/i)?.[1] ?? null;
        const widthAttr = el.getAttribute("width");
        const width = zoom || widthAttr || null;
        let align: string | null = null;
        if (/float\s*:\s*left/i.test(style)) align = "left";
        else if (/float\s*:\s*right/i.test(style)) align = "right";
        else if (/margin\s*:\s*0\s*auto/i.test(style)) align = "center";
        else {
          const a = el.getAttribute("align");
          if (a === "left" || a === "right" || a === "center") align = a;
        }
        return {
          src: el.getAttribute("src") || "",
          alt: el.getAttribute("alt"),
          title: el.getAttribute("title"),
          width,
          align,
        };
      },
    },
  ],
  toDOM(node) {
    const { src, alt, title, width, align } = node.attrs;
    const styles: string[] = [];
    if (width) styles.push(`zoom: ${width}`);
    if (align === "left") styles.push("float: left");
    else if (align === "right") styles.push("float: right");
    else if (align === "center") styles.push("display: block");
    const attrs: Record<string, string> = { src };
    if (alt) attrs.alt = alt;
    if (title) attrs.title = title;
    if (styles.length) attrs.style = styles.join("; ");
    if (align === "center") attrs.class = "img-center";
    return ["img", attrs];
  },
};

const nodes = baseSchema.spec.nodes
  .update("image", imageSpec)
  .addToEnd("math_block", mathBlockSpec)
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
    })
    // Font color, applied via the right-click menu (a first-class mark like
    // `link`, NOT the literal-text model — liveFormat leaves it alone because
    // it isn't in MANAGED). Round-trips as Typora-style `<span style="color">`.
    .addToEnd("textColor", {
      attrs: { color: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: "span[style]",
          getAttrs: (dom) => {
            const color = (dom as HTMLElement).style.color;
            return color ? { color } : false;
          },
        },
      ],
      toDOM(mark) {
        return ["span", { style: `color: ${mark.attrs.color}` }, 0];
      },
    })
    // Literal markdown syntax characters (`**` `*` `~~` `==` `` ` `` `~` `^`
    // `<u>` `</u>`) now live in the document as real, editable text. The
    // `markup` mark tags those characters so liveFormat can style them dimly
    // and markupVisibility (Faz B) can collapse them when the caret is away.
    .addToEnd("markup", {
      inclusive: false,
      parseDOM: [{ tag: "span.md-markup" }],
      toDOM() {
        return ["span", { class: "md-markup" }, 0];
      },
    }),
});
