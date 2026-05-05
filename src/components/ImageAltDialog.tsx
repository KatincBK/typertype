import { useEffect, useRef, useState } from "react";

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
      <div className="image-alt-dialog" role="dialog" aria-label="Görsel özellikleri">
        <h2>Görsel Özellikleri</h2>
        <label className="image-alt-field">
          <span>Alt metin</span>
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
          <span>Başlık (hover ipucu)</span>
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
            Vazgeç
          </button>
          <button type="button" className="primary" onClick={submit}>
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
