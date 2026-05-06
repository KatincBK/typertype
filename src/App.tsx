import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import i18n, { setAppLanguage } from "@/lib/i18n";
import {
  Editor,
  DEFAULT_FIND_OPTIONS,
  type EditorHandle,
  type FindOptions,
  type FindReportStatus,
} from "@/editor";
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
import { addRecent, getRecents, removeRecent } from "@/lib/recents";
import {
  clearRecovery,
  readRecovery,
  writeRecovery,
} from "@/lib/recovery";
import { useTheme, type ThemePreference } from "@/lib/themes";
import { applyUserCss, loadUserCss } from "@/lib/userCss";
import { buildHtmlDocument, type HtmlExportMode } from "@/lib/exportHtml";
import { checkPandoc, exportViaPandoc } from "@/lib/exportPandoc";
import { useSettings } from "@/lib/settings";
import { getInitialArgs } from "@/lib/launchArgs";
import { checkForUpdate } from "@/lib/updater";
import { addUserWord, ignoreWord, setSpellLanguage } from "@/lib/spellChecker";
import { loadUserDict, persistUserDict } from "@/lib/userDict";
import { printDocument } from "@/lib/print";
import { SpellMenu } from "@/components/SpellMenu";
import type { SpellContextDetail } from "@/editor/spell";
import {
  onFileChanged,
  unwatchFile,
  watchFile,
  type FileChangedPayload,
} from "@/lib/fileWatcher";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/Sidebar";
import { FindBar } from "@/components/FindBar";
import { ExportMenu, type ExportFormat } from "@/components/ExportMenu";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ImageAltDialog } from "@/components/ImageAltDialog";
import { ImageLightbox } from "@/components/ImageLightbox";
import type {
  ImageAltEditDetail,
  ImageLightboxDetail,
} from "@/editor/imageView";
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
- Sidebar: \`Ctrl+Shift+L\`, Bul: \`Ctrl+F\`, Değiştir: \`Ctrl+H\`, Sonraki: \`F3\`
- Undo/redo: \`Ctrl+Z\` / \`Ctrl+Y\`
`;

function App() {
  const { t } = useTranslation();
  const UNTITLED_LABEL = t("common.untitled");
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

  // MVP-4 — find/replace state. The query / options / replacement live in
  // App so React can drive the input fields; the actual matches and
  // current-index live in the find plugin and are mirrored back here via
  // the editor's onFindChange callback.
  const [findOpen, setFindOpen] = useState(false);
  const [findMode, setFindMode] = useState<"find" | "replace">("find");
  const [findQuery, setFindQuery] = useState("");
  const [findReplacement, setFindReplacement] = useState("");
  const [findOptions, setFindOptions] = useState<FindOptions>({
    ...DEFAULT_FIND_OPTIONS,
  });
  const [findStatus, setFindStatus] = useState<FindReportStatus>({
    matchCount: 0,
    currentIndex: -1,
  });

  // MVP-5 — auto-save / recovery / recents state
  const [recents, setRecents] = useState<string[]>(() => getRecents());
  // Gate the recovery snapshot effect until we've decided whether to honor
  // the existing recovery file on startup, so we don't blindly clobber it.
  const [recoveryHandled, setRecoveryHandled] = useState(false);

  // MVP-6 — theme + custom CSS
  const theme = useTheme();
  useEffect(() => {
    void loadUserCss().then(applyUserCss);
  }, []);

  // MVP-8 — settings (live-updates CSS vars + drives the auto-save / recovery
  // delays below)
  const settingsApi = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // FAZ 11 follow-up — image dialogs are driven by custom DOM events
  // bubbled out of the ImageView NodeView. We hold the per-event commit
  // callback in a ref because dialog state lives in React but the
  // commit closure was captured at the time the event fired.
  const [altDialog, setAltDialog] = useState<{
    alt: string;
    title: string;
  } | null>(null);
  const altCommitRef = useRef<((alt: string, title: string) => void) | null>(
    null,
  );
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );

  // FAZ 18 (B) — spell-check right-click menu. Range stays in a ref
  // because it's only consumed on action; React state would re-render
  // the menu with each cursor flicker without buying us anything.
  const [spellMenu, setSpellMenu] = useState<{
    word: string;
    x: number;
    y: number;
  } | null>(null);
  const spellRangeRef = useRef<{ from: number; to: number } | null>(null);

  // FAZ 19 — drive UI language from settings; setAppLanguage flips
  // i18next's active resource bundle and updates the <html lang> attr.
  const appLang = settingsApi.settings.app.language;
  useEffect(() => {
    setAppLanguage(appLang);
  }, [appLang]);

  // FAZ 18 — drive the spell-check engine from settings. setSpellLanguage
  // dispatches the dictionary download / swap; the spell plugin re-scans
  // automatically via onSpellChange when the engine becomes ready.
  const spellLang = settingsApi.settings.spellcheck.language;
  useEffect(() => {
    setSpellLanguage(spellLang === "off" ? null : spellLang);
  }, [spellLang]);

  // Prime the user dictionary once at startup. Subsequent session
  // additions are persisted incrementally via persistUserDict.
  useEffect(() => {
    void loadUserDict().then((words) => {
      for (const w of words) addUserWord(w);
    });
  }, []);

  // Listen for the right-click event the spell plugin bubbles up. The
  // payload's from/to is mapped through later transactions implicitly —
  // we use it the moment the user picks a suggestion, before further
  // edits, so a static snapshot is fine.
  useEffect(() => {
    function onCtx(e: Event) {
      const detail = (e as CustomEvent<SpellContextDetail>).detail;
      spellRangeRef.current = { from: detail.from, to: detail.to };
      setSpellMenu({ word: detail.word, x: detail.x, y: detail.y });
    }
    document.addEventListener("tylike:spell-context", onCtx);
    return () => document.removeEventListener("tylike:spell-context", onCtx);
  }, []);

  const handleSpellReplace = useCallback((replacement: string) => {
    const range = spellRangeRef.current;
    if (!range) return;
    editorRef.current?.replaceRange(range.from, range.to, replacement);
  }, []);

  const handleSpellAddToDict = useCallback(() => {
    if (!spellMenu) return;
    addUserWord(spellMenu.word);
    void persistUserDict(spellMenu.word);
  }, [spellMenu]);

  const handleSpellIgnore = useCallback(() => {
    if (!spellMenu) return;
    ignoreWord(spellMenu.word);
  }, [spellMenu]);

  const editorRef = useRef<EditorHandle>(null);

  const dirty = currentMd !== savedMd;
  const fileLabel = filePath ? basename(filePath) : UNTITLED_LABEL;

  const headings = useMemo(() => extractHeadings(currentMd), [currentMd]);

  const confirmDiscardDirty = useCallback(() => {
    if (!dirty) return true;
    return window.confirm(t("common.discardConfirm"));
  }, [dirty, t]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindQuery("");
    editorRef.current?.findClose();
  }, []);

  const recordRecent = useCallback((path: string) => {
    addRecent(path);
    setRecents(getRecents());
  }, []);

  const loadFile = useCallback(
    (path: string, content: string) => {
      setLoadedMd(content);
      setSavedMd(content);
      setCurrentMd(content);
      setFilePath(path);
      // The editor remounts — its plugin state is gone. Drop our mirror
      // too so a stale "3 / 5" doesn't linger in the bar.
      closeFind();
      recordRecent(path);
    },
    [closeFind, recordRecent],
  );

  const handleNew = useCallback(() => {
    if (!confirmDiscardDirty()) return;
    setLoadedMd("");
    setSavedMd("");
    setCurrentMd("");
    setFilePath(null);
    closeFind();
  }, [confirmDiscardDirty, closeFind]);

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
    recordRecent(target);
  }, [filePath, currentMd, recordRecent]);

  const handleSaveAs = useCallback(async () => {
    const target = await pickSavePath(
      fileLabel.endsWith(".md") ? fileLabel : fileLabel + ".md",
    );
    if (!target) return;
    const ok = await safeSaveFile(target, currentMd);
    if (!ok) return;
    setFilePath(target);
    setSavedMd(currentMd);
    recordRecent(target);
  }, [fileLabel, currentMd, recordRecent]);

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
      if (content === null) {
        // The path is dead (deleted / moved). Drop it from recents so the
        // user doesn't keep clicking a phantom entry.
        removeRecent(path);
        setRecents(getRecents());
        return;
      }
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

  // MVP-7 — export handler. HTML modes go through pure-frontend code; the
  // rest are handed to Pandoc via the Rust command, with a pre-flight
  // check so we can show a useful message if pandoc isn't installed.
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const baseName = filePath
        ? basename(filePath).replace(/\.(md|markdown|txt)$/i, "")
        : UNTITLED_LABEL;

      const isHtml = format === "html-styled" || format === "html-plain";
      if (isHtml) {
        const mode: HtmlExportMode =
          format === "html-styled" ? "styled" : "plain";
        const target = await pickSavePath(`${baseName}.html`);
        if (!target) return;
        const doc = buildHtmlDocument(currentMd, mode, baseName);
        const ok = await safeSaveFile(target, doc);
        if (ok)
          window.alert(t("export.exported", { format: "HTML", path: target }));
        return;
      }

      const check = await checkPandoc();
      if (!check.available) {
        window.alert(check.error ?? t("export.pandocMissing"));
        return;
      }

      const formatMap: Record<ExportFormat, { ext: string; pandoc: string }> = {
        "html-styled": { ext: "html", pandoc: "html5" },
        "html-plain": { ext: "html", pandoc: "html5" },
        docx: { ext: "docx", pandoc: "docx" },
        pdf: { ext: "pdf", pandoc: "pdf" },
        latex: { ext: "tex", pandoc: "latex" },
        epub: { ext: "epub", pandoc: "epub" },
        odt: { ext: "odt", pandoc: "odt" },
        rtf: { ext: "rtf", pandoc: "rtf" },
      };
      const { ext, pandoc } = formatMap[format];
      const target = await pickSavePath(`${baseName}.${ext}`);
      if (!target) return;
      const result = await exportViaPandoc(currentMd, target, pandoc);
      if (result.ok) {
        window.alert(
          t("export.exported", {
            format: format.toUpperCase(),
            path: target,
          }),
        );
      } else {
        window.alert(t("export.errorPrefix") + (result.error ?? ""));
      }
    },
    [filePath, currentMd, t],
  );

  // MVP-4 — find/replace handlers
  const openFind = useCallback((mode: "find" | "replace") => {
    setFindMode(mode);
    setFindOpen(true);
  }, []);

  const handleOptionToggle = useCallback((key: keyof FindOptions) => {
    setFindOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Push the active query / options into the editor's plugin whenever they
  // change. Cleared via closeFind() instead of here to keep the dispatch
  // logic simple.
  useEffect(() => {
    if (!findOpen) return;
    editorRef.current?.findSet(findQuery, findOptions);
  }, [findOpen, findQuery, findOptions]);

  // MVP-5/9 — startup sequence.
  //   1. If the OS launched us with a file path (double-click, CLI arg),
  //      open it directly. The user explicitly chose this file so any
  //      leftover recovery snapshot is skipped.
  //   2. Otherwise, look for a crash-recovery snapshot and, if found,
  //      ask the user whether to restore it.
  //   3. After either branch, flip `recoveryHandled` so the auto-save /
  //      snapshot effects can start running.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const args = await getInitialArgs();
      if (cancelled) return;
      if (args.file) {
        const content = await safeReadFile(args.file);
        if (cancelled) return;
        if (content !== null) {
          loadFile(args.file, content);
        }
        setRecoveryHandled(true);
        return;
      }

      const snap = await readRecovery();
      if (cancelled) return;
      if (!snap) {
        setRecoveryHandled(true);
        return;
      }
      const label = snap.filePath ? basename(snap.filePath) : UNTITLED_LABEL;
      const when = new Date(snap.savedAt).toLocaleString();
      // Use i18n.t directly: this effect runs once on mount and can't
      // see future language changes through the closured t().
      const ok = window.confirm(i18n.t("recovery.prompt", { label, when }));
      if (cancelled) return;
      if (ok) {
        setLoadedMd(snap.content);
        setSavedMd(""); // mark dirty so the indicator is visible
        setCurrentMd(snap.content);
        setFilePath(snap.filePath);
        if (snap.filePath) recordRecent(snap.filePath);
      } else {
        await clearRecovery();
      }
      setRecoveryHandled(true);
    })();
    return () => {
      cancelled = true;
    };
    // loadFile / recordRecent are stable; we deliberately run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MVP-9 — auto-updater check on mount. The placeholder endpoint in
  // tauri.conf.json resolves to nothing during dev, so this is a quiet
  // no-op until a real release manifest exists. checkForUpdate swallows
  // network / configuration errors, so it never disrupts startup.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const update = await checkForUpdate();
      if (cancelled || !update) return;
      const ok = window.confirm(
        i18n.t("updater.prompt", {
          version: update.version,
          body: update.body ?? "",
        }),
      );
      if (!ok) return;
      const { downloadAndInstallUpdate } = await import("@/lib/updater");
      await downloadAndInstallUpdate();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // MVP-5/8 — auto-save: when the doc is dirty AND has a path on disk,
  // write the latest content after the configured delay (default 2 s) of
  // typing inactivity. Re-running the effect on every keystroke +
  // cleanup-resets-the-timer gives us the debounce for free.
  const autoSaveMs = settingsApi.settings.files.autoSaveMs;
  useEffect(() => {
    if (!recoveryHandled) return;
    if (!filePath || !dirty) return;
    const timer = setTimeout(async () => {
      const ok = await safeSaveFile(filePath, currentMd);
      if (ok) {
        setSavedMd(currentMd);
        recordRecent(filePath);
      }
    }, autoSaveMs);
    return () => clearTimeout(timer);
  }, [recoveryHandled, filePath, currentMd, dirty, recordRecent, autoSaveMs]);

  // MVP-5/8 — recovery snapshot: every N seconds of inactivity while dirty,
  // write the snapshot. When the doc goes clean (saved or matches disk),
  // delete the snapshot so the next launch doesn't offer to "recover"
  // already-saved work.
  const recoveryMs = settingsApi.settings.files.recoveryMs;
  useEffect(() => {
    if (!recoveryHandled) return;
    if (!dirty) {
      void clearRecovery();
      return;
    }
    const timer = setTimeout(() => {
      void writeRecovery(filePath, currentMd);
    }, recoveryMs);
    return () => clearTimeout(timer);
  }, [recoveryHandled, dirty, filePath, currentMd, recoveryMs]);

  // MVP-5 — window blur handler. Save / snapshot immediately (no debounce)
  // so a crash or accidental close after the user tabs away still keeps
  // their last typed state. Bound once via stateRef to avoid re-binding
  // the listener every keystroke.
  const blurStateRef = useRef({ filePath, currentMd, dirty, recoveryHandled });
  blurStateRef.current = { filePath, currentMd, dirty, recoveryHandled };
  useEffect(() => {
    function onBlur() {
      const s = blurStateRef.current;
      if (!s.recoveryHandled || !s.dirty) return;
      if (s.filePath) {
        void safeSaveFile(s.filePath, s.currentMd).then((ok) => {
          if (ok) setSavedMd(s.currentMd);
        });
      }
      void writeRecovery(s.filePath, s.currentMd);
    }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // FAZ 7 — watch the active file on disk so external edits surface in
  // the editor. Mirror the latest doc state into a ref so the bound
  // listener (registered once) sees fresh values without re-binding.
  const watchStateRef = useRef({ filePath, savedMd, currentMd });
  watchStateRef.current = { filePath, savedMd, currentMd };

  useEffect(() => {
    if (!filePath) {
      void unwatchFile();
      return;
    }
    void watchFile(filePath);
    return () => {
      // Don't unwatch on rerun — the next watchFile() call replaces the
      // active watcher in Rust. Only unwatch when the file goes away.
    };
  }, [filePath]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;
    void onFileChanged((payload: FileChangedPayload) => {
      const s = watchStateRef.current;
      if (!s.filePath || payload.path !== s.filePath) return;
      if (payload.error || payload.content === null) {
        // File was deleted or unreadable — surface it but don't try to
        // overwrite the editor with empty content.
        return;
      }
      const incoming = payload.content;
      // Filter our own writes: when we just saved, the disk content
      // matches what we have in memory.
      if (incoming === s.savedMd) return;
      const dirty = s.currentMd !== s.savedMd;
      if (dirty) {
        const ok = window.confirm(i18n.t("fileWatcher.externalChange"));
        if (!ok) {
          // Keep local edits but mark as dirty against the new disk
          // baseline so the next save knows it's overwriting.
          setSavedMd(incoming);
          return;
        }
      }
      setLoadedMd(incoming);
      setSavedMd(incoming);
      setCurrentMd(incoming);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // FAZ 11 follow-up — listen for image events bubbled from NodeView.
  useEffect(() => {
    function onAltEdit(e: Event) {
      const detail = (e as CustomEvent<ImageAltEditDetail>).detail;
      altCommitRef.current = detail.commit;
      setAltDialog({ alt: detail.alt, title: detail.title });
    }
    function onLightbox(e: Event) {
      const detail = (e as CustomEvent<ImageLightboxDetail>).detail;
      setLightbox({ src: detail.src, alt: detail.alt });
    }
    document.addEventListener("tylike:image-alt-edit", onAltEdit);
    document.addEventListener("tylike:image-lightbox", onLightbox);
    return () => {
      document.removeEventListener("tylike:image-alt-edit", onAltEdit);
      document.removeEventListener("tylike:image-lightbox", onLightbox);
    };
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const insertImage = useCallback(
    () => editorRef.current?.insertImageFromDialog(),
    [],
  );
  // FAZ 13 — Print. Title falls back to "Untitled" when there's no
  // disk path; that label flows into the iframe <title> so the
  // browser/OS print dialog has something readable to show.
  const handlePrint = useCallback(() => {
    const title = filePath
      ? basename(filePath).replace(/\.(md|markdown|txt)$/i, "")
      : UNTITLED_LABEL;
    void printDocument(currentMd, title);
  }, [filePath, currentMd, UNTITLED_LABEL]);

  const handlersRef = useRef({
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    toggleSidebar,
    openFind,
    closeFind,
    openSettings,
    insertImage,
    handlePrint,
    findNext: () => editorRef.current?.findNext(),
    findPrev: () => editorRef.current?.findPrev(),
    findOpen,
  });
  handlersRef.current = {
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    toggleSidebar,
    openFind,
    closeFind,
    openSettings,
    insertImage,
    handlePrint,
    findNext: () => editorRef.current?.findNext(),
    findPrev: () => editorRef.current?.findPrev(),
    findOpen,
  };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const h = handlersRef.current;
      const mod = e.ctrlKey || e.metaKey;

      // F3 / Shift+F3 work without a modifier
      if (e.key === "F3") {
        e.preventDefault();
        if (e.shiftKey) h.findPrev();
        else h.findNext();
        return;
      }

      // Esc closes the find bar even when focus is back in the editor —
      // otherwise users get stuck with stale highlights and no obvious way
      // to dismiss them after clicking back into the document.
      if (e.key === "Escape" && h.findOpen) {
        e.preventDefault();
        h.closeFind();
        return;
      }

      if (!mod) return;
      const key = e.key.toLowerCase();
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
      } else if (key === "f" && !e.shiftKey) {
        e.preventDefault();
        h.openFind("find");
      } else if (key === "h" && !e.shiftKey) {
        e.preventDefault();
        h.openFind("replace");
      } else if (e.key === ",") {
        // Ctrl+, opens Settings (Typora / VS Code convention).
        e.preventDefault();
        h.openSettings();
      } else if (key === "i" && e.shiftKey) {
        // Ctrl+Shift+I — Insert image (matches CONTROLS.md).
        e.preventDefault();
        h.insertImage();
      } else if (key === "p" && !e.shiftKey) {
        // Ctrl+P — Print (Typora / browser convention).
        e.preventDefault();
        h.handlePrint();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`app-shell${sidebarOpen ? " has-sidebar" : ""}`}>
      <header className="app-header">
        <h1 className="app-title">{t("header.appName")}</h1>
        <span className="app-file" title={filePath ?? UNTITLED_LABEL}>
          {fileLabel}
          {dirty ? <span className="app-dirty"> ●</span> : null}
        </span>
        <span className="app-stats">
          {t("header.characters", { count: currentMd.length })}
        </span>
        <ExportMenu onExport={handleExport} onPrint={handlePrint} />
        <select
          className="app-theme-select"
          value={theme.preference}
          onChange={(e) =>
            theme.setPreference(e.target.value as ThemePreference)
          }
          title={t("header.themeTitle")}
        >
          <option value="auto">{t("header.themeAuto")}</option>
          <option value="light">{t("header.themeLight")}</option>
          <option value="dark">{t("header.themeDark")}</option>
          <option value="sepia">{t("header.themeSepia")}</option>
        </select>
      </header>
      <div className="app-body">
        {sidebarOpen ? (
          <Sidebar
            rootPath={rootPath}
            tree={tree}
            activeFilePath={filePath}
            headings={headings}
            recents={recents}
            onPickFolder={handlePickFolder}
            onFileClick={handleFileFromTree}
            onJumpHeading={handleJumpHeading}
          />
        ) : null}
        <main className="app-main">
          {findOpen ? (
            <FindBar
              mode={findMode}
              query={findQuery}
              replacement={findReplacement}
              options={findOptions}
              status={findStatus}
              onQueryChange={setFindQuery}
              onReplacementChange={setFindReplacement}
              onOptionToggle={handleOptionToggle}
              onFindNext={() => editorRef.current?.findNext()}
              onFindPrev={() => editorRef.current?.findPrev()}
              onReplaceCurrent={() =>
                editorRef.current?.replaceCurrent(findReplacement)
              }
              onReplaceAll={() =>
                editorRef.current?.replaceAll(findReplacement)
              }
              onClose={closeFind}
            />
          ) : null}
          <Editor
            ref={editorRef}
            initialMarkdown={loadedMd}
            currentFilePath={filePath}
            onChange={setCurrentMd}
            onFindChange={setFindStatus}
          />
        </main>
      </div>
      <SettingsDialog
        open={settingsOpen}
        api={settingsApi}
        onClose={() => setSettingsOpen(false)}
      />
      <ImageAltDialog
        open={altDialog !== null}
        initialAlt={altDialog?.alt ?? ""}
        initialTitle={altDialog?.title ?? ""}
        onCommit={(alt, title) => altCommitRef.current?.(alt, title)}
        onClose={() => setAltDialog(null)}
      />
      <ImageLightbox
        open={lightbox !== null}
        src={lightbox?.src ?? ""}
        alt={lightbox?.alt ?? ""}
        onClose={() => setLightbox(null)}
      />
      <SpellMenu
        open={spellMenu !== null}
        word={spellMenu?.word ?? ""}
        x={spellMenu?.x ?? 0}
        y={spellMenu?.y ?? 0}
        onReplace={handleSpellReplace}
        onAddToDict={handleSpellAddToDict}
        onIgnore={handleSpellIgnore}
        onClose={() => setSpellMenu(null)}
      />
    </div>
  );
}

export default App;
