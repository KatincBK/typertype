// MVP-3 — extract H1-H6 headings from raw markdown for the outline panel.
// Operates on the source text directly so the outline updates whenever the
// editor reports a new docToMarkdown via onChange — no extra editor hook.
//
// Skips fences (``` blocks) and indented code blocks; ignores ATX headings
// inside HTML and inside fenced code. Preserves source ordering.

export interface HeadingItem {
  level: number;
  text: string;
  /** Absolute character offset of the heading line's `#` in the source. */
  offset: number;
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split("\n");
  const out: HeadingItem[] = [];
  let inFence = false;
  let offset = 0;
  for (const raw of lines) {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
    } else if (!inFence) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);
      if (m) {
        out.push({
          level: m[1].length,
          text: m[2].trim(),
          offset,
        });
      }
    }
    offset += raw.length + 1; // +1 for the \n we split on
  }
  return out;
}
