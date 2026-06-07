// Shared text-formatting cheatsheet, rendered both in the About dialog and in
// the sidebar's "Formatting" section. Kept in one place so the two stay in
// sync. `t` is the i18next translator (label keys live under about.formatting.*).

export interface FormatEntry {
  /** CSS class that previews the effect (fmt-bold, fmt-italic, …). */
  cls: string;
  label: string;
  syntax: string;
  shortcut?: string;
}

export function buildFormattingGuide(t: (key: string) => string): FormatEntry[] {
  const sample = t("about.formatting.sample");
  return [
    { cls: "fmt-bold", label: t("about.formatting.bold"), syntax: `**${sample}**`, shortcut: "Ctrl+B" },
    { cls: "fmt-italic", label: t("about.formatting.italic"), syntax: `*${sample}*`, shortcut: "Ctrl+I" },
    { cls: "fmt-underline", label: t("about.formatting.underline"), syntax: `<u>${sample}</u>`, shortcut: "Ctrl+U" },
    { cls: "fmt-strike", label: t("about.formatting.strikethrough"), syntax: `~~${sample}~~` },
    { cls: "fmt-highlight", label: t("about.formatting.highlight"), syntax: `==${sample}==` },
    { cls: "fmt-code", label: t("about.formatting.code"), syntax: `\`${sample}\``, shortcut: "Ctrl+Shift+`" },
    { cls: "fmt-sub", label: t("about.formatting.subscript"), syntax: `~${sample}~` },
    { cls: "fmt-sup", label: t("about.formatting.superscript"), syntax: `^${sample}^` },
    { cls: "fmt-link", label: t("about.formatting.link"), syntax: `[${sample}](url)`, shortcut: "Ctrl+K" },
  ];
}
