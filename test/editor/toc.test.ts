import { describe, expect, it } from "vitest";
import type { Node } from "prosemirror-model";
import { markdownToDoc } from "@/editor/serializer";
import { headingText } from "@/editor/toc";
import { schema } from "@/editor/schema";

// In the literal-marker model a heading node's textContent includes the raw
// `**` / `<u>` characters. headingText strips the `markup`-marked text so the
// table of contents lists "Bold title", not "**Bold** title".

function firstHeading(md: string): Node {
  const doc = markdownToDoc(md);
  let heading: Node | undefined;
  doc.descendants((n) => {
    if (n.type.name === "heading" && !heading) heading = n;
  });
  if (!heading) throw new Error("no heading");
  return heading;
}

describe("headingText", () => {
  it("strips inline markdown markers from a heading", () => {
    expect(headingText(firstHeading("# **Bold** title"), schema.marks.markup)).toBe(
      "Bold title",
    );
  });

  it("strips several marker kinds", () => {
    expect(
      headingText(firstHeading("## a *b* `c` <u>d</u>"), schema.marks.markup),
    ).toBe("a b c d");
  });

  it("leaves an unformatted heading untouched", () => {
    expect(headingText(firstHeading("# Plain heading"), schema.marks.markup)).toBe(
      "Plain heading",
    );
  });
});
