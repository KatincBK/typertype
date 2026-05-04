import { markdownItInstance } from "@/editor/serializer";

// MVP-7 — HTML export. Two modes:
//   "styled" — wraps the rendered body in a full HTML document with embedded
//              base CSS, the KaTeX stylesheet pulled from a CDN, and the
//              mermaid script so diagrams render in any browser.
//   "plain"  — just the rendered body inside a bare <html><body>; useful
//              when the output is going to be styled by some other tool
//              (Word import, Notion, etc.).

export type HtmlExportMode = "styled" | "plain";

const KATEX_CDN_CSS =
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">';

const MERMAID_CDN_SCRIPT = `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true });</script>`;

const BUILTIN_CSS = `
  :root { color-scheme: light; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.7;
    max-width: 760px;
    margin: 2rem auto;
    padding: 0 1.5rem;
    color: #1a1a1a;
    background: #ffffff;
  }
  h1, h2, h3, h4, h5, h6 { font-weight: 700; line-height: 1.3; margin: 1.5em 0 0.5em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  p { margin: 0.6em 0; }
  a { color: #2563eb; }
  code {
    background: rgba(0, 0, 0, 0.06);
    padding: 0.15em 0.35em;
    border-radius: 3px;
    font-family: Consolas, Monaco, monospace;
    font-size: 0.9em;
  }
  pre {
    background: rgba(0, 0, 0, 0.06);
    padding: 1em;
    border-radius: 6px;
    overflow-x: auto;
    font-family: Consolas, Monaco, monospace;
    line-height: 1.5;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 3px solid #ccc;
    margin: 1em 0;
    padding: 0 1em;
    color: #555;
  }
  table { border-collapse: collapse; margin: 1em 0; }
  table th, table td { border: 1px solid #ddd; padding: 0.4em 0.6em; }
  table th { background: rgba(0, 0, 0, 0.04); font-weight: 600; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  mark { background: rgba(255, 230, 0, 0.5); padding: 0 0.15em; border-radius: 2px; }
  .math-block { text-align: center; margin: 1em 0; }
  .mermaid { text-align: center; margin: 1em 0; }
  sup { font-size: 0.75em; vertical-align: super; line-height: 0; }
  sub { font-size: 0.75em; vertical-align: sub; line-height: 0; }
  .footnote-item p { display: inline; margin: 0; }
  .footnotes { font-size: 0.9em; border-top: 1px solid #ddd; margin-top: 2em; padding-top: 1em; }
`;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function renderMarkdownToHtmlBody(markdown: string): string {
  return markdownItInstance.render(markdown);
}

export function buildHtmlDocument(
  markdown: string,
  mode: HtmlExportMode,
  title: string,
): string {
  const body = renderMarkdownToHtmlBody(markdown);
  if (mode === "plain") {
    return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>${escapeAttr(title)}</title></head>
<body>
${body}
</body>
</html>`;
  }
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${escapeAttr(title)}</title>
${KATEX_CDN_CSS}
<style>${BUILTIN_CSS}</style>
</head>
<body>
${body}
${MERMAID_CDN_SCRIPT}
</body>
</html>`;
}
