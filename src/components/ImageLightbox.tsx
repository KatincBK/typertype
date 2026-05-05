import { useEffect } from "react";

interface Props {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
}

// FAZ 11 follow-up — full-window image viewer. Mounted in App, opened
// from the ImageView's "⛶" popover button. ESC closes; any backdrop
// click closes too.
export function ImageLightbox({ open, src, alt, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="image-lightbox-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-label="Görsel önizleme"
    >
      <button
        type="button"
        className="image-lightbox-close"
        title="Kapat (Esc)"
        onClick={onClose}
      >
        ×
      </button>
      <img className="image-lightbox-img" src={src} alt={alt} />
    </div>
  );
}
