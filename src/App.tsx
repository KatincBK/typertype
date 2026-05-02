import { useState } from "react";
import { Editor } from "@/editor";
import "./App.css";

const SAMPLE_MARKDOWN = `# Tylike

Bu bir **markdown editörü**. Yazmaya _başla_.

## Kısayollar

- Heading: \`Ctrl+1\` … \`Ctrl+6\`, paragraph: \`Ctrl+0\`
- Bold \`Ctrl+B\`, italic \`Ctrl+I\`, code \`Ctrl+\\\`\`
- Quote: \`Ctrl+Shift+Q\`, bullet list: \`Ctrl+Shift+8\`, numbered: \`Ctrl+Shift+7\`
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`

## Typing Rules

\`#\` ile başlık, \`>\` blockquote, \`-\` veya \`*\` liste, \`1.\` numaralı liste.

> Markdown'u WYSIWYG olarak gör. Sembolleri yazınca otomatik dönüşür.

\`\`\`
function hello() {
  return "world";
}
\`\`\`
`;

function App() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Tylike</h1>
        <span className="app-stats">{markdown.length} karakter</span>
      </header>
      <main className="app-main">
        <Editor initialMarkdown={SAMPLE_MARKDOWN} onChange={setMarkdown} />
      </main>
    </div>
  );
}

export default App;
