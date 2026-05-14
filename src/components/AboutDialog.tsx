import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const shortcuts: Array<[string, string]> = [
    ["Ctrl+N", t("about.shortcuts.new")],
    ["Ctrl+O", t("about.shortcuts.open")],
    ["Ctrl+S", t("about.shortcuts.save")],
    ["Ctrl+Shift+S", t("about.shortcuts.saveAs")],
    ["Ctrl+F", t("about.shortcuts.find")],
    ["Ctrl+H", t("about.shortcuts.replace")],
    ["Ctrl+Shift+L", t("about.shortcuts.toggleSidebar")],
    ["Ctrl+,", t("about.shortcuts.settings")],
    ["Ctrl+Shift+I", t("about.shortcuts.insertImage")],
    ["Ctrl+P", t("about.shortcuts.print")],
  ];

  const sample = t("about.formatting.sample");
  const formatting: Array<{
    cls: string;
    label: string;
    syntax: string;
    shortcut?: string;
  }> = [
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="about-header">
          <h2>{t("about.title")}</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>
        <div className="about-body">
          <p className="about-tagline">{t("about.tagline")}</p>
          <h3 className="about-section-title">{t("about.shortcutsTitle")}</h3>
          <table className="about-shortcuts">
            <tbody>
              {shortcuts.map(([key, label]) => (
                <tr key={key}>
                  <td>
                    <kbd>{key}</kbd>
                  </td>
                  <td>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="about-section-title">{t("about.formattingTitle")}</h3>
          <table className="about-shortcuts about-formatting">
            <tbody>
              {formatting.map((f) => (
                <tr key={f.cls}>
                  <td>
                    <span className={f.cls}>{f.label}</span>
                  </td>
                  <td>
                    <code>{f.syntax}</code>
                  </td>
                  <td>{f.shortcut ? <kbd>{f.shortcut}</kbd> : <span className="fmt-none">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="about-hint">{t("about.formattingHint")}</p>
        </div>
      </div>
    </div>
  );
}
