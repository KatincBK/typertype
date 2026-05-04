import { useState } from "react";
import type { FileEntry } from "@/lib/folderIO";

interface Props {
  entry: FileEntry;
  /** Path of the file currently open in the editor — highlighted in the tree. */
  activePath: string | null;
  onFileClick: (path: string) => void;
  /** Root entries render flat (no chevron) so the user sees the folder
   *  contents immediately on first load. */
  isRoot?: boolean;
}

export function FileTree({ entry, activePath, onFileClick, isRoot }: Props) {
  // Root expanded by default; nested folders collapsed.
  const [expanded, setExpanded] = useState<boolean>(!!isRoot);

  if (!entry.is_dir) {
    const isActive = entry.path === activePath;
    return (
      <button
        type="button"
        className={`file-tree-leaf${isActive ? " is-active" : ""}`}
        onClick={() => onFileClick(entry.path)}
        title={entry.path}
      >
        <span className="file-tree-icon">📄</span>
        <span className="file-tree-label">{entry.name}</span>
      </button>
    );
  }

  return (
    <div className="file-tree-folder">
      {!isRoot && (
        <button
          type="button"
          className="file-tree-folder-header"
          onClick={() => setExpanded((v) => !v)}
          title={entry.path}
        >
          <span className="file-tree-chevron">{expanded ? "▾" : "▸"}</span>
          <span className="file-tree-icon">📁</span>
          <span className="file-tree-label">{entry.name}</span>
        </button>
      )}
      {expanded && entry.children && entry.children.length > 0 ? (
        <div className={isRoot ? "file-tree-root-children" : "file-tree-children"}>
          {entry.children.map((child) => (
            <FileTree
              key={child.path}
              entry={child}
              activePath={activePath}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      ) : null}
      {expanded && entry.children && entry.children.length === 0 && !isRoot ? (
        <div className="file-tree-empty">boş</div>
      ) : null}
    </div>
  );
}
