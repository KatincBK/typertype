import type { FileEntry } from "@/lib/folderIO";
import type { HeadingItem } from "@/lib/headings";
import { FileTree } from "./FileTree";
import { Outline } from "./Outline";

interface Props {
  rootPath: string | null;
  tree: FileEntry | null;
  activeFilePath: string | null;
  headings: HeadingItem[];
  onPickFolder: () => void;
  onFileClick: (path: string) => void;
  onJumpHeading: (index: number) => void;
}

export function Sidebar({
  rootPath,
  tree,
  activeFilePath,
  headings,
  onPickFolder,
  onFileClick,
  onJumpHeading,
}: Props) {
  return (
    <aside className="sidebar">
      <section className="sidebar-section">
        <header className="sidebar-section-header">
          <span>Dosyalar</span>
          <button
            type="button"
            className="sidebar-action"
            onClick={onPickFolder}
            title="Klasör aç"
          >
            Klasör Aç
          </button>
        </header>
        {rootPath ? (
          <div className="sidebar-root" title={rootPath}>
            {rootPath}
          </div>
        ) : (
          <div className="sidebar-empty">Henüz klasör seçilmedi</div>
        )}
        {tree ? (
          <FileTree
            entry={tree}
            activePath={activeFilePath}
            onFileClick={onFileClick}
            isRoot
          />
        ) : null}
      </section>
      <section className="sidebar-section sidebar-outline-section">
        <header className="sidebar-section-header">
          <span>İçindekiler</span>
        </header>
        <Outline headings={headings} onJump={onJumpHeading} />
      </section>
    </aside>
  );
}
