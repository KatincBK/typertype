import { useCallback, useEffect, useState } from "react";
import { Editor } from "@/editor";
import {
  basename,
  pickSavePath,
  safeOpenFile,
  safeSaveFile,
} from "@/lib/fileIO";
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
- Dosya: \`Ctrl+N\` (yeni), \`Ctrl+O\` (aç), \`Ctrl+S\` (kaydet), \`Ctrl+Shift+S\` (farklı kaydet)
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`
`;

const UNTITLED_LABEL = "Adsız";
const DIRTY_CONFIRM =
  "Kaydedilmemiş değişiklikler kaybolacak. Devam etmek istiyor musunuz?";

function App() {
  // Three snapshots:
  //   loadedMd  — what the editor was last initialized with. Drives the
  //               <Editor> remount so it ONLY changes on new / open.
  //   savedMd   — what's currently on disk. Drives the dirty indicator
  //               (savedMd === currentMd ⇒ clean). Save updates this in
  //               place WITHOUT remounting the editor and losing caret.
  //   currentMd — live editor content, fed by Editor.onChange.
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loadedMd, setLoadedMd] = useState(SAMPLE_MARKDOWN);
  const [savedMd, setSavedMd] = useState(SAMPLE_MARKDOWN);
  const [currentMd, setCurrentMd] = useState(SAMPLE_MARKDOWN);

  const dirty = currentMd !== savedMd;
  const fileLabel = filePath ? basename(filePath) : UNTITLED_LABEL;

  const confirmDiscardDirty = useCallback(() => {
    if (!dirty) return true;
    return window.confirm(DIRTY_CONFIRM);
  }, [dirty]);

  const handleNew = useCallback(() => {
    if (!confirmDiscardDirty()) return;
    setLoadedMd("");
    setSavedMd("");
    setCurrentMd("");
    setFilePath(null);
  }, [confirmDiscardDirty]);

  const handleOpen = useCallback(async () => {
    if (!confirmDiscardDirty()) return;
    const opened = await safeOpenFile();
    if (!opened) return;
    setLoadedMd(opened.content);
    setSavedMd(opened.content);
    setCurrentMd(opened.content);
    setFilePath(opened.path);
  }, [confirmDiscardDirty]);

  const handleSave = useCallback(async () => {
    let target = filePath;
    if (!target) {
      target = await pickSavePath(UNTITLED_LABEL + ".md");
      if (!target) return;
    }
    const ok = await safeSaveFile(target, currentMd);
    if (!ok) return;
    setFilePath(target);
    setSavedMd(currentMd); // loadedMd intentionally unchanged → no remount
  }, [filePath, currentMd]);

  const handleSaveAs = useCallback(async () => {
    const target = await pickSavePath(
      fileLabel.endsWith(".md") ? fileLabel : fileLabel + ".md",
    );
    if (!target) return;
    const ok = await safeSaveFile(target, currentMd);
    if (!ok) return;
    setFilePath(target);
    setSavedMd(currentMd);
  }, [fileLabel, currentMd]);

  // Window-level shortcuts. Bound on document because the editor lives in
  // its own focus subtree and ProseMirror's keymap doesn't see Ctrl+S unless
  // it's explicitly bound there. We preventDefault so the browser's "save
  // page" dialog never appears.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        void handleSave();
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        void handleSaveAs();
      } else if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        void handleOpen();
      } else if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        handleNew();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, handleNew]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Tylike</h1>
        <span className="app-file" title={filePath ?? UNTITLED_LABEL}>
          {fileLabel}
          {dirty ? <span className="app-dirty"> ●</span> : null}
        </span>
        <span className="app-stats">{currentMd.length} karakter</span>
      </header>
      <main className="app-main">
        <Editor initialMarkdown={loadedMd} onChange={setCurrentMd} />
      </main>
    </div>
  );
}

export default App;
