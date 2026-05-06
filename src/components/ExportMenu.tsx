import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// MVP-7 — Export dropdown. Pure UI; the actual export logic (HTML build,
// Pandoc invoke, save dialog, etc.) lives in the App handler this calls.

export type ExportFormat =
  | "html-styled"
  | "html-plain"
  | "docx"
  | "pdf"
  | "latex"
  | "epub"
  | "rtf"
  | "odt";

interface Option {
  id: ExportFormat;
  labelKey: string;
  hint?: string;
}

// Hint strings stay un-keyed: they're either parenthetical proper nouns
// (Pandoc, Microsoft Word) or short technical phrases that read fine in
// either locale. Only the format names go through i18next.
const OPTIONS: Option[] = [
  { id: "html-styled", labelKey: "export.htmlStyled" },
  { id: "html-plain", labelKey: "export.htmlPlain" },
  { id: "docx", labelKey: "export.docx", hint: "Pandoc · Microsoft Word" },
  { id: "pdf", labelKey: "export.pdf", hint: "Pandoc + LaTeX" },
  { id: "latex", labelKey: "export.latex", hint: "Pandoc" },
  { id: "epub", labelKey: "export.epub", hint: "Pandoc" },
  { id: "odt", labelKey: "export.odt", hint: "Pandoc · OpenDocument" },
  { id: "rtf", labelKey: "export.rtf", hint: "Pandoc" },
];

interface Props {
  onExport: (format: ExportFormat) => void;
  onPrint: () => void;
}

export function ExportMenu({ onExport, onPrint }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (e.target instanceof Node && containerRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="export-menu" ref={containerRef}>
      <button
        type="button"
        className="export-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t("export.menuTitle")}
      >
        {t("export.menuTitle")} ▾
      </button>
      {open ? (
        <div className="export-menu-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="export-menu-item"
            onClick={() => {
              setOpen(false);
              onPrint();
            }}
          >
            <span className="export-menu-label">{t("export.print")}</span>
            <span className="export-menu-hint">Ctrl+P</span>
          </button>
          <div className="export-menu-sep" />
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitem"
              className="export-menu-item"
              onClick={() => {
                setOpen(false);
                onExport(opt.id);
              }}
            >
              <span className="export-menu-label">{t(opt.labelKey)}</span>
              {opt.hint ? (
                <span className="export-menu-hint">{opt.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
