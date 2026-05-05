import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { FindOptions, FindReportStatus } from "@/editor";

interface Props {
  mode: "find" | "replace";
  query: string;
  replacement: string;
  options: FindOptions;
  status: FindReportStatus;
  onQueryChange: (q: string) => void;
  onReplacementChange: (r: string) => void;
  onOptionToggle: (key: keyof FindOptions) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export function FindBar(props: Props) {
  const { t } = useTranslation();
  const queryRef = useRef<HTMLInputElement>(null);

  // Auto-focus the query input each time the bar mounts. mode is in deps so
  // switching between find / replace also re-focuses the query.
  useEffect(() => {
    queryRef.current?.focus();
    queryRef.current?.select();
  }, [props.mode]);

  const handleQueryKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) props.onFindPrev();
      else props.onFindNext();
    }
  };

  const handleReplacementKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) props.onReplaceAll();
      else props.onReplaceCurrent();
    }
  };

  const matchLabel = props.query
    ? props.status.matchCount === 0
      ? t("find.noMatches")
      : t("find.matchStatus", {
          current: props.status.currentIndex + 1,
          total: props.status.matchCount,
        })
    : "";

  return (
    <div className="find-bar" role="search">
      <div className="find-row">
        <input
          ref={queryRef}
          className="find-input"
          type="text"
          placeholder={`${t("find.findPlaceholder")}…`}
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={handleQueryKey}
        />
        <span className="find-status">{matchLabel}</span>
        <button
          type="button"
          className="find-btn"
          title={`${t("find.previous")} (Shift+Enter)`}
          onClick={props.onFindPrev}
          disabled={props.status.matchCount === 0}
        >
          ↑
        </button>
        <button
          type="button"
          className="find-btn"
          title={`${t("find.next")} (Enter)`}
          onClick={props.onFindNext}
          disabled={props.status.matchCount === 0}
        >
          ↓
        </button>
        <button
          type="button"
          className={`find-btn find-toggle${props.options.caseSensitive ? " is-active" : ""}`}
          title={t("find.matchCase")}
          aria-pressed={props.options.caseSensitive}
          onClick={() => props.onOptionToggle("caseSensitive")}
        >
          Aa
        </button>
        <button
          type="button"
          className={`find-btn find-toggle${props.options.wholeWord ? " is-active" : ""}`}
          title={t("find.wholeWord")}
          aria-pressed={props.options.wholeWord}
          onClick={() => props.onOptionToggle("wholeWord")}
        >
          W
        </button>
        <button
          type="button"
          className={`find-btn find-toggle${props.options.regex ? " is-active" : ""}`}
          title={t("find.regex")}
          aria-pressed={props.options.regex}
          onClick={() => props.onOptionToggle("regex")}
        >
          .*
        </button>
        <button
          type="button"
          className="find-btn find-close"
          title={`${t("common.close")} (Esc)`}
          onClick={props.onClose}
        >
          ×
        </button>
      </div>
      {props.mode === "replace" ? (
        <div className="find-row">
          <input
            className="find-input"
            type="text"
            placeholder={`${t("find.replacePlaceholder")}…`}
            value={props.replacement}
            onChange={(e) => props.onReplacementChange(e.target.value)}
            onKeyDown={handleReplacementKey}
          />
          <button
            type="button"
            className="find-btn"
            title={`${t("find.replaceOne")} (Enter)`}
            onClick={props.onReplaceCurrent}
            disabled={props.status.matchCount === 0}
          >
            {t("find.replaceOne")}
          </button>
          <button
            type="button"
            className="find-btn"
            title={`${t("find.replaceAll")} (Shift+Enter)`}
            onClick={props.onReplaceAll}
            disabled={props.status.matchCount === 0}
          >
            {t("find.replaceAll")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
