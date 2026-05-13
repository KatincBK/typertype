import { useEffect, useState, type ReactNode } from "react";

interface Props {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  storageKey,
  defaultOpen = true,
  actions,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === null) return defaultOpen;
      return v === "1";
    } catch {
      return defaultOpen;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      // ignored — localStorage may be disabled
    }
  }, [open, storageKey]);

  return (
    <section
      className={`sidebar-section${open ? "" : " is-collapsed"}${className ? " " + className : ""}`}
    >
      <header className="sidebar-section-header">
        <button
          type="button"
          className="sidebar-section-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="sidebar-chevron" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          <span>{title}</span>
        </button>
        {actions ? <span className="sidebar-section-actions">{actions}</span> : null}
      </header>
      {open ? <div className="sidebar-section-body">{children}</div> : null}
    </section>
  );
}
