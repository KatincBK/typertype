import { useEffect, useMemo, useRef } from "react";
import { suggestWord } from "@/lib/spellChecker";

interface Props {
  open: boolean;
  word: string;
  x: number;
  y: number;
  onReplace: (replacement: string) => void;
  onAddToDict: () => void;
  onIgnore: () => void;
  onClose: () => void;
}

// FAZ 18 (B) — right-click suggestions menu. Positioned at the click
// coords, dismissed on outside click / Escape / a chosen action.
// Suggestions are computed once per open via useMemo so re-renders
// from coordinate changes don't re-query nspell unnecessarily.
export function SpellMenu({
  open,
  word,
  x,
  y,
  onReplace,
  onAddToDict,
  onIgnore,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!open || !word) return [];
    return suggestWord(word, 6);
  }, [open, word]);

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

  // Clamp to the viewport so a click near the bottom-right doesn't
  // anchor the menu off-screen. The 220×260 number is a generous upper
  // bound for the menu's natural size.
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 260);

  return (
    <div
      ref={menuRef}
      className="spell-menu"
      style={{ left, top }}
      role="menu"
    >
      <div className="spell-menu-header">{word}</div>
      {suggestions.length === 0 ? (
        <div className="spell-menu-empty">Öneri yok</div>
      ) : (
        suggestions.map((s) => (
          <button
            key={s}
            type="button"
            className="spell-menu-item"
            role="menuitem"
            onClick={() => {
              onReplace(s);
              onClose();
            }}
          >
            {s}
          </button>
        ))
      )}
      <div className="spell-menu-sep" />
      <button
        type="button"
        className="spell-menu-item"
        role="menuitem"
        onClick={() => {
          onAddToDict();
          onClose();
        }}
      >
        Sözlüğe ekle
      </button>
      <button
        type="button"
        className="spell-menu-item"
        role="menuitem"
        onClick={() => {
          onIgnore();
          onClose();
        }}
      >
        Yoksay (oturum)
      </button>
    </div>
  );
}
