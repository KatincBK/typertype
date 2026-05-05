import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  initialAlt: string;
  initialTitle: string;
  onCommit: (alt: string, title: string) => void;
  onClose: () => void;
}

// FAZ 11 follow-up — modal counterpart of Typora's "Image Properties"
// dialog. We only expose alt / title (resize and align live in the
// popover); a future pass can add src editing here.
export function ImageAltDialog({
  open,
  initialAlt,
  initialTitle,
  onCommit,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [alt, setAlt] = useState(initialAlt);
  const [title, setTitle] = useState(initialTitle);
  const altRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAlt(initialAlt);
    setTitle(initialTitle);
    queueMicrotask(() => altRef.current?.select());
  }, [open, initialAlt, initialTitle]);

  if (!open) return null;

  const submit = () => {
    onCommit(alt, title);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="image-alt-dialog"
        role="dialog"
        aria-label={t("image.altDialog.title")}
      >
        <h2>{t("image.altDialog.title")}</h2>
        <label className="image-alt-field">
          <span>{t("image.altDialog.alt")}</span>
          <input
            ref={altRef}
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") onClose();
            }}
          />
        </label>
        <label className="image-alt-field">
          <span>{t("image.altDialog.titleField")}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") onClose();
            }}
          />
        </label>
        <div className="image-alt-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" onClick={submit}>
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
