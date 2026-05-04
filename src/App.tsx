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

## Math (Adım 8)

Inline: Einstein denklemi $E = mc^2$ ve Pisagor $a^2 + b^2 = c^2$.

Block:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid (Adım 9)

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B(ProseMirror)
  B --> C{KaTeX / Mermaid?}
  C -->|evet| D[NodeView]
  C -->|hayır| E[Plain Text]
\`\`\`

## Emoji (Adım 7)

Yazınca \`:smile:\` → :smile:, \`:rocket:\` → :rocket:, \`:tada:\` → :tada:.
Yazarken \`:\` sonrasına başlarsan otomatik popup açılır (Yön tuşları + Enter / Esc).

## İçindekiler (Adım 11)

[toc]

## Tablo (Adım 10) — \`Ctrl+T\` ile yenisini ekle

| Özellik | Durum | Açıklama |
| --- | :---: | --- |
| WYSIWYG | ✅ | ProseMirror tabanlı |
| Math | ✅ | KaTeX |
| Mermaid | ✅ | Live preview |
| Tablo | ✅ | prosemirror-tables |

## Dipnotlar (Adım 11)

Bu cümlede bir dipnot[^1] var, ardından bir tane daha[^typora].

[^1]: İlk dipnot, sayısal id'li.
[^typora]: Dipnot id'leri serbest metin olabilir.

## Kısayollar

- Heading: \`Ctrl+1\` … \`Ctrl+6\`, paragraph: \`Ctrl+0\`
- Bold \`Ctrl+B\`, italic \`Ctrl+I\`, underline \`Ctrl+U\`, strike \`Alt+Shift+5\`
- Math block \`Ctrl+Shift+M\`, code fence \`Ctrl+Shift+K\`, table \`Ctrl+T\`
- Quote: \`Ctrl+Shift+Q\`, bullet: \`Ctrl+Shift+]\`, numbered: \`Ctrl+Shift+[\`
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
