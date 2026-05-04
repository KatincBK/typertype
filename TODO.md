# Tylike — Yapılacaklar Listesi (Roadmap)

> Tauri 2 + React 19 + ProseMirror tabanlı, Typora benzeri Windows markdown editörü.

## Mevcut Durum

- **Tamamlanan**: FAZ 0 (mimari), FAZ 1 (iskelet), FAZ 3 (parse/serialize), FAZ 4 başlangıç (çekirdek WYSIWYG), **Typora-Parity Track tüm 13 adım ✅**
- **Sıradaki**: Parity sonrası MVP-2 (dosya I/O), MVP-3 (sidebar) vb.
- **Strateji**: Hızlı MVP yerine adım adım eksiksiz Typora uyumu. Parity tamamlandı.

---

## Typora-Parity Track (Aktif)

Bu adımlar tamamlanana kadar dosya I/O, sidebar, export gibi diğer fazlar **ertelendi**. Sıra önemli:

| # | Adım | Süre | Durum |
|---|---|---|---|
| 1 | Schema genişletme: strikethrough, highlight, sub, sup, underline mark'ları | 30 dk | [x] |
| 2 | Yeni inline typing rules: `~~`, `==`, `~sub~`, `^sup^` (live-format plugin) | 30 dk | [x] |
| 3 | A tercihi: block trigger Enter ile (heading/quote/list/code) + code block çıkış UX | 1 saat | [x] |
| 4 | Klavye kısayolları Typora ile birebir eşle | 1 saat | [x] |
| 5 | Auto-Pair plugin (brackets, quotes, markdown chars) | 1 saat | [x] (sadece brackets — quotes smartQuotes ile, markdown chars live-format ile) |
| 6 | SmartyPants: `--`, `---`, `...`, curly quotes | 30 dk | [x] |
| 7 | Emoji shortcode (`:smile:`) + auto-complete popup | 1.5 saat | [x] |
| 8 | Math block (KaTeX): `$$..$$` ve `$..$` rendering | 2 saat | [x] |
| 9 | Mermaid diyagramlar (`\`\`\`mermaid`) | 1.5 saat | [x] |
| 10 | Interactive tablo: focus toolbar + drag resize | 3 saat | [x] |
| 11 | Footnote (`[^1]`) + TOC (`[toc]`) rendering | 1.5 saat | [x] |
| 12a | ~~Live conversion (`appendTransaction` ile her değişiklikte pattern tarama)~~ | — | [x] (Adım 2 ile birlikte) |
| 12b | Source vs Rendered toggle UX (cursor on element → markdown source görünür) | 1.5 saat | [x] |
| 13 | Custom shortcut config (`%APPDATA%\Tylike\conf\conf.user.json`) | 1 saat | [x] |

**Toplam ~17 saat** çekirdek kod. Detaylar `CONTROLS.md`'de.

> **A tercihi notu**: Block elementler (heading, quote, list, code fence) sadece **Enter** tuşunda dönüşür. Implementasyon `src/editor/blockEnter.ts`'te; eski space tabanlı input rules kaldırıldı. Code block içinde son satır boş + Enter → blok dışına çıkar.

---

## Parity Sonrası MVP Sırası

Editör Typora seviyesine gelince bu sırayla devam:

1. [x] **MVP-1**: ProseMirror WYSIWYG + typing rules + kısayollar
2. [x] **MVP-2**: Dosya I/O (open/save/save-as, Ctrl+S/O, dirty indicator)
3. [ ] **MVP-3**: Sidebar — klasör tree + dosya listesi
4. [ ] **MVP-4**: Find & Replace (Ctrl+F/H)
5. [ ] **MVP-5**: Auto-save + crash recovery + recent files
6. [ ] **MVP-6**: Tema sistemi (light/dark + custom CSS)
7. [ ] **MVP-7**: Export (PDF, HTML, DOCX via Pandoc)
8. [ ] **MVP-8**: Settings UI
9. [ ] **MVP-9**: Build & dağıtım (MSI + auto-updater)

---

## FAZ 0 — Hazırlık & Mimari ✅

- [x] Tauri 2.x (Windows MSI + NSIS)
- [x] React + TypeScript (Vite)
- [x] CodeMirror 6 (Source Mode) + ProseMirror (WYSIWYG) hibriti
- [x] remark/unified markdown engine (gelecekte özel eklentiler için)
- [x] Zustand state management (planda)
- [x] CSS theme variables sistemi
- [x] Rust backend modüler yapısı

## FAZ 1 — Proje İskeleti ✅

- [x] Rust + Node + MSVC + Git kurulu
- [x] `create-tauri-app` ile scaffold
- [x] Klasör yapısı: components, editor, lib, store, hooks, themes, i18n, types
- [x] TypeScript strict mode + `@/*` path alias
- [x] Vite + Tauri config
- [x] `tauri.conf.json` temel yapılandırma
- [x] Logger (frontend)
- [x] Rust tracing subscriber
- [x] Error boundary (React)
- [x] `.editorconfig`, `.gitattributes`
- [x] Git init + initial commit
- [ ] ESLint + Prettier (MVP sonrası)
- [ ] Husky pre-commit hook (MVP sonrası)

## FAZ 2 — IPC ve Sistem Entegrasyonu

- [ ] Type-safe IPC bridge (`tauri-specta` veya custom)
- [ ] `read_file`, `write_file`, `read_dir`, `stat`, `rename`, `delete`
- [ ] Trash desteği (move_to_trash)
- [ ] Encoding tespiti (UTF-8, BOM, UTF-16) — `encoding_rs`
- [ ] Line ending koruma (CRLF/LF)
- [ ] File watcher — `notify` crate
- [ ] Native dialog (open/save) — `tauri-plugin-dialog`
- [ ] Clipboard (text + HTML + image)
- [ ] Shell ops (open in explorer, reveal)

## FAZ 3 — Markdown Engine

- [x] `prosemirror-markdown` ile temel parse/serialize
- [ ] `remark` + `remark-gfm` (GFM özellikleri)
- [ ] `remark-frontmatter` (YAML)
- [ ] `remark-math` + KaTeX
- [ ] Mermaid eklentisi
- [ ] Flowchart.js
- [ ] Footnote desteği
- [x] Task list (`- [ ]`)
- [ ] Emoji shortcode (`:smile:`)
- [ ] Highlight (`==text==`), sub/sup
- [ ] `[TOC]` direktifi
- [ ] Page break direktifi
- [ ] HTML sanitization (`rehype-sanitize`)
- [ ] AST round-trip koruması
- [ ] Strict Mode toggle

## FAZ 4 — WYSIWYG Editor (çekirdek)

- [x] ProseMirror schema (heading, paragraph, blockquote, list, code, hr)
- [x] Inline marks (bold, italic, code, link)
- [x] Markdown ↔ ProseMirror dönüşüm
- [x] Live preview (Typora imza özelliği)
- [x] Input rules (`# `, `> `, `- `, `1. `, `\`\`\``)
- [ ] Auto-pair: `()`, `[]`, `{}`, `""`, `**`, `__`, `~~`, `` ` ``
- [ ] SmartyPants (`--`→en-dash, vb.)
- [ ] Block tipini değiştirme menüsü
- [x] Tab/Shift+Tab list indent/outdent
- [x] Undo/redo
- [ ] Drag & drop blok yeniden sıralama
- [ ] Caret konumuna göre markdown sembol gösterimi
- [ ] Paste: HTML→Markdown
- [ ] Paste plain text (Ctrl+Shift+V)
- [ ] Copy as Markdown (Ctrl+Shift+C)
- [ ] Copy as HTML
- [x] Word/character count (live)
- [ ] Reading time tahmini

## FAZ 5 — Source Mode & Görüntü Modları

- [ ] Source Code mode (Ctrl+/) — CodeMirror 6
- [ ] Focus Mode (F8) — diğer satırları soluklaştır
- [ ] Typewriter Mode (F9) — aktif satır dikey ortala
- [ ] Fullscreen (F11)
- [ ] Reading mode (read-only)
- [ ] Zoom: Ctrl++ / Ctrl+- / Ctrl+0
- [ ] Toggle sidebar (Ctrl+Shift+L)
- [ ] Yazı alanı genişliği ayarı

## FAZ 6 — Dosya Operasyonları

- [ ] New file (Ctrl+N), New window (Ctrl+Shift+N)
- [ ] Open file (Ctrl+O), Open folder
- [ ] Save (Ctrl+S), Save As (Ctrl+Shift+S)
- [ ] Auto-save (debounce + on focus loss)
- [ ] Dirty flag yönetimi (`●` başlık çubuğunda)
- [ ] Çıkışta kaydedilmemiş değişiklikler için onay
- [ ] Recent files menüsü
- [ ] Reopen Closed File (Ctrl+Shift+T)
- [ ] Open Quickly (Ctrl+P) — fuzzy file finder
- [ ] Crash recovery (periyodik snapshot)
- [ ] Version history (lokal snapshot)
- [ ] External change detection → reload prompt
- [ ] "Reveal in Explorer", "Open with default app"
- [ ] Move to trash

## FAZ 7 — Sidebar (File Tree, Articles, Outline)

- [ ] 3 panel: File Tree / Articles / Outline
- [ ] File tree: expand/collapse, lazy load
- [ ] Context menu (new, rename, delete, reveal)
- [ ] Drag & drop dosya/klasör taşıma
- [ ] Watch root folder
- [ ] Articles panel: aktif klasördeki .md listesi
- [ ] Outline panel: H1-H6 ağacı, tıkla-zıpla
- [ ] Sidebar resize + persist
- [ ] Search in folder (Ctrl+Shift+F, regex)

## FAZ 8 — Find & Replace

- [ ] Find in document (Ctrl+F): match count, prev/next
- [ ] Replace (Ctrl+H): tek tek + tümü
- [ ] Case sensitive, whole word, regex
- [ ] Find in folder (full-text)
- [ ] Match highlight

## FAZ 9 — Math & Diagrams & Code

- [ ] KaTeX (mhchem, AMSmath)
- [ ] Math live preview
- [ ] Otomatik denklem numaralama
- [ ] Inline vs block math
- [ ] Mermaid (flowchart, sequence, class, state, gantt, pie, ER)
- [ ] Mermaid hata mesajı UI
- [ ] Flowchart.js
- [ ] Code fence dil seçimi
- [ ] Syntax highlighter (Shiki ~150 dil)
- [ ] Code block line numbers
- [ ] Code copy button

## FAZ 10 — Tablolar

- [ ] Markdown table parse + render
- [ ] Hücre içi düzenleme
- [ ] Sütun/satır ekle-sil
- [ ] Sütun hizalama
- [ ] Mouse drag ile resize
- [ ] Drag-reorder
- [ ] Klavyeden hızlı tablo (Ctrl+T)
- [ ] CSV/TSV yapıştırma → tablo

## FAZ 11 — Görsel Yönetimi

- [ ] Insert image (dialog, drag-drop, paste)
- [ ] Image rendering (markdown'da gizli)
- [ ] Image resize (drag handle)
- [ ] Image alignment
- [ ] Image policy: absolute / relative / copy to assets / move / upload
- [ ] Custom upload script (CLI çağrısı, stdout=URL)
- [ ] Image preview (zoom modal)
- [ ] Broken image placeholder
- [ ] Embed video / iframe (YouTube, Vimeo)
- [ ] Local PDF embed

## FAZ 12 — Tema Sistemi

- [ ] Theme loader (kullanıcı `themes/` klasörü)
- [ ] Built-in: Github, Newsprint, Whitey, Night, Pixyll, Han
- [ ] Dark/Light toggle (sistem teması algıla)
- [ ] Theme menu
- [ ] Theme hot reload
- [ ] Custom CSS injection
- [ ] Code block tema eşleştirme

## FAZ 13 — Export

- [ ] PDF (print-to-PDF, bookmarks)
- [ ] HTML (with/without style)
- [ ] HTML + assets (klasör)
- [ ] PNG/JPEG (rendered)
- [ ] DOCX (Pandoc)
- [ ] OpenOffice ODT (Pandoc)
- [ ] LaTeX (Pandoc)
- [ ] MediaWiki (Pandoc)
- [ ] ePub (Pandoc)
- [ ] RTF (Pandoc)
- [ ] OPML
- [ ] Pandoc tespit & kurulum UI
- [ ] Export ayarları (margin, page size, theme)
- [ ] Print

## FAZ 14 — Import

- [ ] DOCX → Markdown (Pandoc)
- [ ] OpenOffice
- [ ] HTML
- [ ] LaTeX
- [ ] "Convert & Reformat Markdown" tool

## FAZ 15 — Settings / Preferences

- [ ] Preferences dialog (Ctrl+,)
- [ ] General (dil, başlangıç, tray, auto-update)
- [ ] Appearance (tema, font, line height, width)
- [ ] Editor (auto-pair, smartypants, strict, indent)
- [ ] Markdown extensions toggles
- [ ] Image (insert policy, assets folder, upload service)
- [ ] Files (auto-save, encoding, line ending)
- [ ] Spell check (dil)
- [ ] Export (Pandoc yolu, formatlar)
- [ ] Themes klasörü, custom.css
- [ ] Keybindings (JSON override)
- [ ] Updater (kanal, otomatik kontrol)
- [ ] Advanced settings (`conf.user.json`)
- [ ] Reset to default

## FAZ 16 — Menüler & Klavye Kısayolları

- [ ] Native menubar (Tauri Menu API)
- [ ] File menu
- [ ] Edit menu
- [ ] Paragraph menu (Heading, Quote, Code, List, Table, TOC, YAML)
- [ ] Format menu
- [ ] View menu
- [ ] Themes menu
- [ ] Help menu (docs, shortcuts, about, logs)
- [ ] Right-click context menu
- [x] Temel kısayollar (Ctrl+B/I/`, Ctrl+1-6, vb.)
- [ ] Tüm Typora kısayolları
- [ ] Custom shortcut override

## FAZ 17 — Pencere & Tab

- [ ] Multi-window vs single-window seçimi
- [ ] Window state persist (pos, size, maximize)
- [ ] Window title (file + dirty + folder)
- [ ] Always on top
- [ ] Multi-instance handling

## FAZ 18 — Spell Check

- [ ] Hunspell (Rust crate)
- [ ] Sözlük indirme/yönetim UI
- [ ] Çoklu dil
- [ ] Yanlış yazım kırmızı altı çizili
- [ ] Sağ tık öneri menüsü
- [ ] Kullanıcı sözlüğü

## FAZ 19 — i18n

- [ ] i18n framework (i18next)
- [ ] EN + TR (başlangıç)
- [ ] CN, ES, DE, FR, JA (genişletme)
- [ ] RTL (Arabic/Hebrew, deneysel)
- [ ] Tarih/saat lokalizasyonu

## FAZ 20 — Performans

- [ ] Büyük dosya (10MB+) chunked parse
- [ ] Web Worker'da markdown parse
- [ ] Virtual scrolling
- [ ] Debounced auto-save
- [ ] Mermaid/KaTeX render cache
- [ ] Lazy image loading
- [ ] Profiling, leak audit

## FAZ 21 — CLI / Sistem Entegrasyonu

- [ ] Launch args: `tylike file.md`, `--new`, folder/
- [ ] Windows file association (`.md`, `.markdown`)
- [ ] Explorer "Open with Tylike"
- [ ] URI scheme (`tylike://`)
- [ ] "Get logs" zip
- [ ] Debug themes mode (devtools)

## FAZ 22 — Test

- [ ] Rust unit (`cargo test`)
- [ ] Frontend unit (Vitest)
- [ ] Markdown round-trip fixtures
- [ ] ProseMirror schema tests
- [ ] E2E (Tauri WebDriver / Playwright)
- [ ] Performance regression
- [ ] CI (GitHub Actions Windows runner)
- [ ] Manual test checklist

## FAZ 23 — Build & Dağıtım

- [ ] MSI (WiX) + NSIS installer
- [ ] Code signing (Authenticode)
- [ ] Portable build (single exe)
- [ ] Auto-updater (Tauri updater plugin)
- [ ] App icon (.ico, çoklu res)
- [ ] Installer dil seçimi, kısayol, file association
- [ ] Uninstall temizliği
- [ ] ARM64 Windows (opsiyonel)
- [ ] Microsoft Store (opsiyonel)

## FAZ 24 — Erişilebilirlik & Kalite

- [ ] ARIA, klavye nav
- [ ] Screen reader test (NVDA)
- [ ] High contrast tema
- [ ] Yüksek DPI
- [ ] Crash reporter (opt-in)
- [ ] Anonim telemetri (opt-in)
- [ ] GDPR / privacy

## FAZ 25 — Dokümantasyon & Yayın

- [ ] Kullanıcı dökümanı (quick start, MD ref, shortcuts)
- [ ] Geliştirici dökümanı (build, contribute)
- [ ] Tema yazma rehberi
- [ ] Web sitesi / landing
- [ ] Changelog & semver
- [ ] Beta program
- [ ] v1.0 release

---

## Notlar

- Düz sırayla 25 faz aylar alır → MVP-First yolu öneriliyor
- Pandoc bağımlılığı: export için runtime gerekli, kurulum yönergesi gerek
- Code signing sertifikası: Windows SmartScreen için elzem (~$200/yıl)
