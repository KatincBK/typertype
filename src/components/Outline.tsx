import type { HeadingItem } from "@/lib/headings";

interface Props {
  headings: HeadingItem[];
  onJump: (index: number) => void;
}

export function Outline({ headings, onJump }: Props) {
  if (headings.length === 0) {
    return <div className="outline-empty">Henüz başlık yok</div>;
  }
  return (
    <div className="outline">
      {headings.map((h, i) => (
        <button
          type="button"
          key={`${h.offset}-${i}`}
          className={`outline-item outline-h${h.level}`}
          onClick={() => onJump(i)}
          title={h.text}
        >
          {h.text}
        </button>
      ))}
    </div>
  );
}
