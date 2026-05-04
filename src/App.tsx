import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Editor, type EditorHandle } from "@/editor";
import {
  basename,
  pickSavePath,
  safeOpenFile,
  safeReadFile,
  safeSaveFile,
} from "@/lib/fileIO";
import {
  pickFolder,
  safeReadDirTree,
  type FileEntry,
} from "@/lib/folderIO";
import { extractHeadings } from "@/lib/headings";
import { Sidebar } from "@/components/Sidebar";
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
- Sidebar: \`Ctrl+Shift+L\`
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`
`;

const UNTITLED_LABEL = "Adsız";
const DIRTY_CONFIRM =
  "Kaydedilmemiş değişiklikler kaybolacak. Devam etmek istiyor musunuz?";

function App() {
  // Three markdown snapshots — see the MVP-2 commit message for why these
  // are separate. loadedMd drives the <Editor> remount.
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loadedMd, setLoadedMd] = useState(SAMPLE_MARKDOWN);
  const [savedMd, setSavedMd] = useState(SAMPLE_MARKDOWN);
  const [currentMd, setCurrentMd] = useState(SAMPLE_MARKDOWN);

  // MVP-3 — sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<FileEntry | null>(null);

  const editorRef = useRef<EditorHandle>(null);

  const dirty = currentMd !== savedMd;
  const fileLabel = filePath ? basename(filePath) : UNTITLED_LABEL;

  const headings = useMemo(() => extractHeadings(currentMd), [currentMd]);

  const confirmDiscardDirty = useCallback(() => {
    if (!dirty) return true;
    return window.confirm(DIRTY_CONFIRM);
  }, [dirty]);

  const loadFile = useCallback((path: string, content: string) => {
    setLoadedMd(content);
    setSavedMd(content);
    setCurrentMd(content);
    setFilePath(path);
  }, []);

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
    loadFile(opened.path, opened.content);
  }, [confirmDiscardDirty, loadFile]);

  const handleSave = useCallback(async () => {
    let target = filePath;
    if (!target) {
      target = await pickSavePath(UNTITLED_LABEL + ".md");
      if (!target) return;
    }
    const ok = await safeSaveFile(target, currentMd);
    if (!ok) return;
    setFilePath(target);
    setSavedMd(currentMd);
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

  // MVP-3 — sidebar handlers
  const handlePickFolder = useCallback(async () => {
    const path = await pickFolder();
    if (!path) return;
    const t = await safeReadDirTree(path);
    if (!t) return;
    setRootPath(path);
    setTree(t);
  }, []);

  const handleFileFromTree = useCallback(
    async (path: string) => {
      if (path === filePath) return; // already open, no-op
      if (!confirmDiscardDirty()) return;
      const content = await safeReadFile(path);
      if (content === null) return;
      loadFile(path, content);
    },
    [filePath, confirmDiscardDirty, loadFile],
  );

  const handleJumpHeading = useCallback((index: number) => {
    editorRef.current?.scrollToHeadingByIndex(index);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => !v);
  }, []);

  const handlersRef = useRef({
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    toggleSidebar,
  });
  handlersRef.current = {
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    toggleSidebar,
  };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const h = handlersRef.current;
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        void h.handleSave();
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        void h.handleSaveAs();
      } else if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        void h.handleOpen();
      } else if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        h.handleNew();
      } else if (key === "l" && e.shiftKey) {
        e.preventDefault();
        h.toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`app-shell${sidebarOpen ? " has-sidebar" : ""}`}>
      <header className="app-header">
        <h1 className="app-title">Tylike</h1>
        <span className="app-file" title={filePath ?? UNTITLED_LABEL}>
          {fileLabel}
          {dirty ? <span className="app-dirty"> ●</span> : null}
        </span>
        <span className="app-stats">{currentMd.length} karakter</span>
      </header>
      <div className="app-body">
        {sidebarOpen ? (
          <Sidebar
            rootPath={rootPath}
            tree={tree}
            activeFilePath={filePath}
            headings={headings}
            onPickFolder={handlePickFolder}
            onFileClick={handleFileFromTree}
            onJumpHeading={handleJumpHeading}
          />
        ) : null}
        <main className="app-main">
          <Editor
            ref={editorRef}
            initialMarkdown={loadedMd}
            onChange={setCurrentMd}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
