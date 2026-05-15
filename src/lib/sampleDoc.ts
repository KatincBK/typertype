import type { AppLanguage } from "./settings";

// FAZ 19 follow-up — sample document shown on first launch (no file
// open, no recovery snapshot). Locale-keyed so a fresh-install English
// user doesn't get a Turkish wall of text. Picked once at App's
// useState initializer; switching the UI language later doesn't
// rewrite the doc the user is already editing.

const TR = `# Typertype

Bu bir **markdown editörü**. Yazmaya _başla_.

## Temel Mark'lar

- **Bold**, _italic_, \`inline code\`, [link](https://example.com)

## Yeni Mark'lar

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

## Math

Inline: Einstein denklemi $E = mc^2$ ve Pisagor $a^2 + b^2 = c^2$.

Block:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B(ProseMirror)
  B --> C{KaTeX / Mermaid?}
  C -->|evet| D[NodeView]
  C -->|hayır| E[Plain Text]
\`\`\`

## Emoji

Yazınca \`:smile:\` → :smile:, \`:rocket:\` → :rocket:, \`:tada:\` → :tada:.
Yazarken \`:\` sonrasına başlarsan otomatik popup açılır (Yön tuşları + Enter / Esc).

## İçindekiler

[toc]

## Tablo — \`Ctrl+T\` ile yenisini ekle

| Özellik | Durum | Açıklama |
| --- | :---: | --- |
| WYSIWYG | ✅ | ProseMirror tabanlı |
| Math | ✅ | KaTeX |
| Mermaid | ✅ | Live preview |
| Tablo | ✅ | prosemirror-tables |

## Dipnotlar

Bu cümlede bir dipnot[^1] var, ardından bir tane daha[^typora].

[^1]: İlk dipnot, sayısal id'li.
[^typora]: Dipnot id'leri serbest metin olabilir.

## Kısayollar

- Heading: \`Ctrl+1\` … \`Ctrl+6\`, paragraph: \`Ctrl+0\`
- Bold \`Ctrl+B\`, italic \`Ctrl+I\`, underline \`Ctrl+U\`, strike \`Alt+Shift+5\`
- Math block \`Ctrl+Shift+M\`, code fence \`Ctrl+Shift+K\`, table \`Ctrl+T\`
- Quote: \`Ctrl+Shift+Q\`, bullet: \`Ctrl+Shift+]\`, numbered: \`Ctrl+Shift+[\`
- Dosya: \`Ctrl+N\` (yeni), \`Ctrl+O\` (aç), \`Ctrl+S\` (kaydet), \`Ctrl+Shift+S\` (farklı kaydet)
- Sidebar: \`Ctrl+Shift+L\`, Bul: \`Ctrl+F\`, Değiştir: \`Ctrl+H\`, Sonraki: \`F3\`
- Yazdır: \`Ctrl+P\`, Görsel: \`Ctrl+Shift+I\`, Ayarlar: \`Ctrl+,\`
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`
`;

const EN = `# Typertype

This is a **markdown editor**. Just _start_ typing.

## Basic marks

- **Bold**, _italic_, \`inline code\`, [link](https://example.com)

## Extra marks

- ~~Strikethrough~~ text
- ==Highlighted== text
- Subscript: H~2~O and CO~2~
- Superscript: x^2^ and E = mc^2^

## Block elements

> Read your markdown as a WYSIWYG document. The symbols you type are
> converted on the fly.

\`\`\`
function hello() {
  return "world";
}
\`\`\`

---

## Math

Inline: Einstein's equation $E = mc^2$ and Pythagoras $a^2 + b^2 = c^2$.

Block:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B(ProseMirror)
  B --> C{KaTeX / Mermaid?}
  C -->|yes| D[NodeView]
  C -->|no| E[Plain Text]
\`\`\`

## Emoji

Typing \`:smile:\` → :smile:, \`:rocket:\` → :rocket:, \`:tada:\` → :tada:.
A popup opens automatically after \`:\` (Arrow keys + Enter / Esc).

## Outline

[toc]

## Tables — insert with \`Ctrl+T\`

| Feature | Status | Notes |
| --- | :---: | --- |
| WYSIWYG | ✅ | ProseMirror-based |
| Math | ✅ | KaTeX |
| Mermaid | ✅ | Live preview |
| Tables | ✅ | prosemirror-tables |

## Footnotes

There's a footnote here[^1], and another one[^tylike].

[^1]: First footnote, numeric id.
[^tylike]: Footnote ids can be free text.

## Shortcuts

- Heading: \`Ctrl+1\` … \`Ctrl+6\`, paragraph: \`Ctrl+0\`
- Bold \`Ctrl+B\`, italic \`Ctrl+I\`, underline \`Ctrl+U\`, strike \`Alt+Shift+5\`
- Math block \`Ctrl+Shift+M\`, code fence \`Ctrl+Shift+K\`, table \`Ctrl+T\`
- Quote: \`Ctrl+Shift+Q\`, bullet: \`Ctrl+Shift+]\`, numbered: \`Ctrl+Shift+[\`
- File: \`Ctrl+N\` (new), \`Ctrl+O\` (open), \`Ctrl+S\` (save), \`Ctrl+Shift+S\` (save as)
- Sidebar: \`Ctrl+Shift+L\`, Find: \`Ctrl+F\`, Replace: \`Ctrl+H\`, Next: \`F3\`
- Print: \`Ctrl+P\`, Image: \`Ctrl+Shift+I\`, Settings: \`Ctrl+,\`
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`
`;

export function getSampleDoc(language: AppLanguage): string {
  return language === "en" ? EN : TR;
}
