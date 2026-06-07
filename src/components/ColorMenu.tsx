import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  x: number;
  y: number;
  /** Color currently on the selection (highlights the matching swatch). */
  current: string | null;
  onPick: (color: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

// Right-click font-color menu (textColor.ts dispatches the open event). Mirrors
// SpellMenu's positioning + outside-click/Escape dismissal. The palette writes
// Typora-compatible `<span style="color:…">` via the textColor mark.
const PALETTE = [
  "#e03131",
  "#e8590c",
  "#f08c00",
  "#2f9e44",
  "#0ca678",
  "#1971c2",
  "#6741d9",
  "#9c36b5",
];

export function ColorMenu({ open, x, y, current, onPick, onRemove, onClose }: Props) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const left = Math.min(x, window.innerWidth - 180);
  const top = Math.min(y, window.innerHeight - 140);

  return (
    <div
      ref={menuRef}
      className="color-menu"
      style={{ left, top }}
      role="menu"
      aria-label={t("color.title")}
    >
      <div className="color-menu-grid">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="menuitemradio"
            aria-checked={current === c}
            className={`color-menu-swatch${current === c ? " is-active" : ""}`}
            style={{ background: c }}
            title={c}
            aria-label={c}
            onClick={() => {
              onPick(c);
              onClose();
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="color-menu-remove"
        role="menuitem"
        onClick={() => {
          onRemove();
          onClose();
        }}
      >
        {t("color.remove")}
      </button>
    </div>
  );
}
