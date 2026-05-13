import { useTranslation } from "react-i18next";
import type { FileEntry } from "@/lib/folderIO";
import type { HeadingItem } from "@/lib/headings";
import { basename } from "@/lib/fileIO";
import { FileTree } from "./FileTree";
import { Outline } from "./Outline";
import { CollapsibleSection } from "./CollapsibleSection";

interface Props {
  rootPath: string | null;
  tree: FileEntry | null;
  activeFilePath: string | null;
  headings: HeadingItem[];
  recents: string[];
  onPickFolder: () => void;
  onFileClick: (path: string) => void;
  onJumpHeading: (index: number) => void;
}

export function Sidebar({
  rootPath,
  tree,
  activeFilePath,
  headings,
  recents,
  onPickFolder,
  onFileClick,
  onJumpHeading,
}: Props) {
  const { t } = useTranslation();
  return (
    <aside className="sidebar">
      {recents.length > 0 ? (
        <CollapsibleSection
          title={t("sidebar.recents")}
          storageKey="sidebar.section.recents"
          defaultOpen={true}
        >
          <div className="sidebar-recents">
            {recents.slice(0, 5).map((path) => (
              <button
                key={path}
                type="button"
                className={`sidebar-recent${path === activeFilePath ? " is-active" : ""}`}
                onClick={() => onFileClick(path)}
                title={path}
              >
                {basename(path)}
              </button>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title={t("sidebar.files")}
        storageKey="sidebar.section.files"
        defaultOpen={true}
        actions={
          <button
            type="button"
            className="sidebar-action"
            onClick={(e) => {
              e.stopPropagation();
              onPickFolder();
            }}
            title={t("sidebar.openFolderTitle")}
          >
            {t("sidebar.openFolderButton")}
          </button>
        }
      >
        {rootPath ? (
          <div className="sidebar-root" title={rootPath}>
            {rootPath}
          </div>
        ) : (
          <div className="sidebar-empty">{t("sidebar.noFolderSelected")}</div>
        )}
        {tree ? (
          <FileTree
            entry={tree}
            activePath={activeFilePath}
            onFileClick={onFileClick}
            isRoot
          />
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title={t("sidebar.outline")}
        storageKey="sidebar.section.outline"
        defaultOpen={true}
      >
        <Outline headings={headings} onJump={onJumpHeading} />
      </CollapsibleSection>
    </aside>
  );
}
