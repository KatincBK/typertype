import { useEffect, useRef, useState } from "react";

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
  label: string;
  hint?: string;
}

const OPTIONS: Option[] = [
  { id: "html-styled", label: "HTML (stilli)" },
  { id: "html-plain", label: "HTML (düz)" },
  { id: "docx", label: "DOCX (Pandoc)", hint: "Microsoft Word" },
  { id: "pdf", label: "PDF (Pandoc)", hint: "LaTeX gerektirir" },
  { id: "latex", label: "LaTeX (Pandoc)" },
  { id: "epub", label: "ePub (Pandoc)" },
  { id: "odt", label: "ODT (Pandoc)", hint: "OpenDocument" },
  { id: "rtf", label: "RTF (Pandoc)" },
];

interface Props {
  onExport: (format: ExportFormat) => void;
}

export function ExportMenu({ onExport }: Props) {
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
        title="Dışa aktar"
      >
        Dışa Aktar ▾
      </button>
      {open ? (
        <div className="export-menu-dropdown" role="menu">
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
              <span className="export-menu-label">{opt.label}</span>
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
