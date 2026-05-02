# Tylike — Kontroller (Typora Uyumlu Referansı)

Bu dosya Typora'nın resmi dokümanlarından derlenmiş kontrol referansıdır.
**Tylike, bu kontrolleri birebir aynı şekilde uygulayacaktır.**

Kaynaklar:
- https://support.typora.io/Shortcut-Keys/
- https://support.typora.io/Markdown-Reference/
- https://support.typora.io/Auto-Pair/
- https://support.typora.io/SmartyPants/
- https://support.typora.io/Advance-Config/

---

## 1. Klavye Kısayolları (Windows)

### 1.1 File
| Komut | Kısayol |
|---|---|
| New | `Ctrl+N` |
| New Window | `Ctrl+Shift+N` |
| Open | `Ctrl+O` |
| Open Quickly | `Ctrl+P` |
| Reopen Closed File | `Ctrl+Shift+T` |
| Save | `Ctrl+S` |
| Save As / Duplicate | `Ctrl+Shift+S` |
| Preferences | `Ctrl+,` |
| Close | `Ctrl+W` |

### 1.2 Edit
| Komut | Kısayol |
|---|---|
| New Paragraph | `Enter` |
| New Line (soft break) | `Shift+Enter` |
| Cut | `Ctrl+X` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Copy as Markdown | `Ctrl+Shift+C` |
| Paste as Plain Text | `Ctrl+Shift+V` |
| Select All | `Ctrl+A` |
| Select Line/Sentence | `Ctrl+L` |
| Select Word | `Ctrl+D` |
| Select Style Scope | `Ctrl+E` |
| Delete Word | `Ctrl+Shift+D` |
| Delete Row (in table) | `Ctrl+Shift+Backspace` |
| Jump to Top | `Ctrl+Home` |
| Jump to Selection | `Ctrl+J` |
| Jump to Bottom | `Ctrl+End` |
| Find | `Ctrl+F` |
| Find Next | `F3` veya `Enter` |
| Find Previous | `Shift+F3` veya `Shift+Enter` |
| Replace | `Ctrl+H` |

### 1.3 Paragraph
| Komut | Kısayol |
|---|---|
| Heading 1–6 | `Ctrl+1` … `Ctrl+6` |
| Paragraph | `Ctrl+0` |
| Increase Heading Level | `Ctrl+=` |
| Decrease Heading Level | `Ctrl+-` |
| Table | `Ctrl+T` |
| Code Fences | `Ctrl+Shift+K` |
| Math Block | `Ctrl+Shift+M` |
| Quote | `Ctrl+Shift+Q` |
| Ordered List | `Ctrl+Shift+[` |
| Unordered List | `Ctrl+Shift+]` |
| Indent | `Ctrl+[` veya `Tab` |
| Outdent | `Ctrl+]` veya `Shift+Tab` |

### 1.4 Format
| Komut | Kısayol |
|---|---|
| Strong (Bold) | `Ctrl+B` |
| Emphasis (Italic) | `Ctrl+I` |
| Underline | `Ctrl+U` |
| Code | ``Ctrl+Shift+` `` |
| Strike | `Alt+Shift+5` |
| Hyperlink | `Ctrl+K` |
| Image | `Ctrl+Shift+I` |
| Clear Format | `Ctrl+\` |

### 1.5 View
| Komut | Kısayol |
|---|---|
| Toggle Sidebar | `Ctrl+Shift+L` |
| Outline | `Ctrl+Shift+1` |
| Articles | `Ctrl+Shift+2` |
| File Tree | `Ctrl+Shift+3` |
| Source Code Mode | `Ctrl+/` |
| Focus Mode | `F8` |
| Typewriter Mode | `F9` |
| Toggle Fullscreen | `F11` |
| Actual Size | `Ctrl+Shift+0` |
| Zoom In | `Ctrl+Shift+=` |
| Zoom Out | `Ctrl+Shift+-` |
| Switch Between Opened Documents | `Ctrl+Tab` |
| Toggle DevTools | `Shift+F12` |

---

## 2. Markdown Typing Rules

### 2.1 Block Elements (Return/Enter ile dönüşür)

| Yazılan | Sonuç | Ne Zaman Tetiklenir |
|---|---|---|
| `# ` … `###### ` + metin + Return | H1 … H6 | Return tuşu |
| `> ` + metin | Blockquote | `>` yazıldığı anda (immediately) |
| `* `, `+ `, `- ` + metin | Unordered list | Return |
| `1. ` + metin | Ordered list | Return |
| `- [ ] ` veya `- [x] ` | Task list | Return |
| ` ``` ` (üç backtick) + dil + Return | Fenced code block | Return |
| `$$` + Return | Math block | Return |
| `***` veya `---` (boş satırda) + Return | Horizontal rule | Return |
| `\| H1 \| H2 \|` + Return | Table (2 sütun) | Return |
| `---` (doküman başında) + Return | YAML front matter | Return |
| `[toc]` + Return | İçindekiler | Return |
| `[^id]` ve `[^id]: metin` | Footnote | Tam yazılınca |

### 2.2 Span Elements (kapanış delimiter ile dönüşür)

| Yazılan | Sonuç |
|---|---|
| `*metin*` veya `_metin_` | İtalik |
| `**metin**` veya `__metin__` | Bold |
| `` `metin` `` | Inline code |
| `~~metin~~` | Strikethrough |
| `==metin==` | Highlight (Preferences'ta açılmalı) |
| `metin~sub~` | Subscript (Preferences'ta açılmalı) |
| `metin^sup^` | Superscript (Preferences'ta açılmalı) |
| `<u>metin</u>` | Underline (HTML) |
| `[text](url)` | Inline link |
| `[text](#header)` | Internal bookmark link |
| `[text][id]` + `[id]: url` | Reference link |
| `<url>` veya bare URL | Auto-link |
| `![alt](path)` | Image |
| `$LaTeX$` | Inline math (Preferences'ta açılmalı) |
| `:emoji-name:` | Emoji (auto-complete açılır) |

### 2.3 Önemli Davranış Kuralları

1. **Block dönüşümü** çoğunlukla Return tuşunda olur
2. **Span dönüşümü** kapanış delimiter yazıldığında olur
3. Cursor span üzerine girince **markdown source** görünür (auto-expansion)
4. Liste / quote içinde Enter **otomatik devam** eder; çift Enter ile çıkış
5. Code block içinden çıkmak için: cursor son satırda, **Mod+Enter** veya bloğun sonrasına git

---

## 3. Auto-Pair Davranışı

### 3.1 Brackets & Quotes (default açık)
- `(` → `()`
- `[` → `[]`
- `{` → `{}`
- `"` → `""`
- `'` → `''`

### 3.2 Markdown Syntax (default açık)
- `*` → `**`
- `` ` `` → `` `` ``
- `_` → `__`

### 3.3 Conditional Pairs
- `=` (sadece highlight açıksa, sadece selection sarma)
- `$` (sadece inline math açıksa)
- `^` (sadece superscript açıksa, sadece selection sarma)
- `~` (sadece selection sarma)

### 3.4 Selection-Wrap Davranışı
Tilde (`~`), eşittir (`=`), caret (`^`) için: **karakteri yazınca otomatik ikinci'si eklenmez**, ama metin seçiliyken bu karakter basılırsa seçim çift karakterle sarılır.

### 3.5 Settings
Preferences panel'de iki toggle:
- "Auto pair brackets and quotes"
- "Auto pair common markdown syntax"

---

## 4. Smart Punctuation (SmartyPants)

### 4.1 Otomatik Dönüşümler
| Yazılan | Dönüşen | Unicode |
|---|---|---|
| `--` | en-dash | `–` (U+2013) |
| `---` | em-dash | `—` (U+2014) |
| `...` | ellipsis | `…` (U+2026) |
| `" ... "` | curly double quotes | `"…"` |
| `' ... '` | curly single quotes | `'…'` |

### 4.2 Conversion Modes
- **Convert on Input**: yazarken anında dönüşür ve Markdown source'a kaydedilir
- Düzgün olmayan dönüşümler **undo (Ctrl+Z)** ile iptal edilebilir

### 4.3 Escape (Dönüşümü Engelleme)
- `\"` → düz tırnak korunur
- `\-` → düz tire korunur

---

## 5. Custom Shortcut Keys

### 5.1 Yapılandırma Dosyası (Tylike)
```
%APPDATA%\Tylike\conf\conf.user.json
```
(Typora ile aynı yaklaşım — sadece klasör adı değişir)

### 5.2 Dosya Formatı (JSON)
```json
{
  "keyBinding": {
    "Always on Top": "Ctrl+Shift+P",
    "Toggle Sidebar": "Ctrl+B",
    "Open Recent": "Ctrl+Alt+R"
  }
}
```

### 5.3 İşlem Akışı
1. Preferences → "Open Advanced Settings"
2. `conf.user.json` aç (yoksa oluştur)
3. `keyBinding` objesi içine eklemeleri yap
4. Uygulamayı yeniden başlat

---

## 6. Tylike'ta Mevcut Uyum Durumu

> Bu bölüm her implementasyon turunda güncellenir.

### 6.1 Tamamlananlar (MVP-1)
- ✅ Heading 1–6 (`Ctrl+1`–`Ctrl+6`, `Ctrl+0` paragraph)
- ✅ Bold/Italic/Code mark (`Ctrl+B`, `Ctrl+I`, ``Ctrl+` ``)
- ✅ Quote (`Ctrl+Shift+Q`), bullet (`Ctrl+Shift+8`), ordered (`Ctrl+Shift+7`)
- ✅ Undo/Redo (`Ctrl+Z`, `Ctrl+Y`)
- ✅ Block typing rules: `# `, `> `, `- `, `1. `, ``\`\`\` ``
- ✅ Inline typing rules: `**bold**`, `*italic*`, `` `code` ``
- ✅ List Tab/Shift+Tab, Enter splitting

### 6.2 Eksikler — Typora'ya Tam Uyum İçin Yapılacaklar
- ❌ Kısayol farkları:
  - `Ctrl+Shift+[` ↔ Ordered List (bizde `Ctrl+Shift+7`)
  - `Ctrl+Shift+]` ↔ Unordered List (bizde `Ctrl+Shift+8`)
  - `Ctrl+[/]` indent/outdent
  - `Ctrl+=` / `Ctrl+-` heading level değiştir
  - `Ctrl+T` table insert
  - `Ctrl+Shift+K` code fences
  - `Ctrl+Shift+M` math block
  - `Ctrl+U` underline
  - `Ctrl+Shift+\`` inline code
  - `Alt+Shift+5` strikethrough
  - `Ctrl+K` hyperlink
  - `Ctrl+Shift+I` image
  - `Ctrl+\` clear format
  - `Ctrl+L` select line, `Ctrl+D` select word, `Ctrl+E` select style scope
  - `Ctrl+Shift+D` delete word
  - `Ctrl+J` jump to selection
- ❌ Block typing davranışları:
  - Şu an: `# ` (space) anında dönüşüyor
  - Typora: `# ` + Return ile dönüşüyor
  - **Karar gerek**: Typora'ya uy mu (Return tetikleyici), yoksa daha hızlı space-tetikleyici mi kalsın?
- ❌ Auto-pair (FAZ 4.7) — hiçbir auto-pair yok şu anda
- ❌ Smart Punctuation — `--`, `---`, `...` dönüşümleri yok
- ❌ Strikethrough (`~~text~~`) typing rule
- ❌ Highlight (`==text==`) typing rule
- ❌ Sub/Sup typing rules
- ❌ Emoji shortcode (`:smile:`) auto-complete
- ❌ Footnote, TOC, YAML, Math block, Page break
- ❌ Tablolar ve auto-link
- ❌ Custom shortcut conf.user.json desteği

---

## 7. UX Detayları (Typora "feel")

### 7.1 Source vs Rendered Görünüm
- Cursor bir markdown elementinin üzerine **girince**, ham markdown gösterilir
- Cursor **çıkınca** yine render edilmiş hali görünür
- Bu auto-expand/collapse davranışı Typora'nın imza tarzı

### 7.2 Liste Otomatik Devamı
- Liste içinde Enter → yeni list item ekler
- **Boş** list item'da Enter → listeden çıkar (paragraf yapar)

### 7.3 Code Block Çıkışı
- Code block sonunda boş satıra `Mod+Enter` (Ctrl+Enter) → block'tan çıkar
- Code fence ` ``` ` yazıp Return → block'a girer

### 7.4 Tablo Düzenleme
- Tablo focus alınca **toolbar** belirir (resize, alignment, delete)
- Mouse drag ile sütun genişliği

### 7.5 Image Drop & Paste
- Drag & drop dosya → resim eklenir (path settings'e göre)
- Clipboard'tan paste → otomatik dosyaya kaydedilir veya base64

---

## 8. Notlar

- Bu doküman Typora'nın resmi davranışlarına uygundur (2026-05 itibarıyla)
- Tylike implementasyonu farkları **Bölüm 6.2**'de listelenir
- Yeni uyumsuzluk bulunduğunda bu dosya güncellenmelidir
