import { useState } from "react";
import { Editor } from "@/editor";
import "./App.css";

const SAMPLE_MARKDOWN = `# Tylike

Bu bir **markdown editörü**. Yazmaya _başla_.

## Temel Mark'lar

- **Bold**, _italic_, \`inline code\`, [link](https://example.com)

## Yeni Mark'lar (Adım 1)

- ~~Üstü çizili~~ metin
- ==Vurgulanmış== metin (highlight)
- Kimya altyazısı: H~2~O ve CO~2~
- Matematik üst yazısı: x^2^ ve E = mc^2^

## Block Elementler

> Markdown'u WYSIWYG olarak gör. Sembolleri yazınca otomatik dönüşür.

\`\`\`
function hello() {
  return "world";
}
\`\`\`

---

## Kısayollar

- Heading: \`Ctrl+1\` … \`Ctrl+6\`, paragraph: \`Ctrl+0\`
- Bold \`Ctrl+B\`, italic \`Ctrl+I\`
- Quote: \`Ctrl+Shift+Q\`, bullet: \`Ctrl+Shift+8\`, numbered: \`Ctrl+Shift+7\`
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`
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
