import { describe, expect, it } from "vitest";
import { buildFormattingGuide } from "@/lib/formattingGuide";

// The cheatsheet feeds both the About dialog and the sidebar's Formatting
// section; this guards the shared contract. An identity translator keeps the
// assertions about structure, not copy.
const t = (k: string) => k;

describe("buildFormattingGuide", () => {
  it("returns all nine formatting effects with unique preview classes", () => {
    const guide = buildFormattingGuide(t);
    expect(guide).toHaveLength(9);
    const classes = guide.map((g) => g.cls);
    expect(new Set(classes).size).toBe(9);
    expect(classes).toContain("fmt-bold");
    expect(classes).toContain("fmt-link");
  });

  it("wraps the sample word with the right markdown syntax", () => {
    const guide = buildFormattingGuide(t);
    const sample = "about.formatting.sample";
    const bold = guide.find((g) => g.cls === "fmt-bold");
    const code = guide.find((g) => g.cls === "fmt-code");
    expect(bold?.syntax).toBe(`**${sample}**`);
    expect(code?.syntax).toBe(`\`${sample}\``);
  });

  it("keeps shortcuts only on the effects that have one", () => {
    const guide = buildFormattingGuide(t);
    expect(guide.find((g) => g.cls === "fmt-bold")?.shortcut).toBe("Ctrl+B");
    expect(guide.find((g) => g.cls === "fmt-strike")?.shortcut).toBeUndefined();
  });
});
