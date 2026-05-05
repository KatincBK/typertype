import { useLayoutEffect, useState } from "react";
import { logger } from "./logger";

// MVP-8 — User-tunable settings. Persisted in localStorage so they survive
// across sessions; applied via CSS variables on :root for the appearance
// fields and read directly by App.tsx for the file timing fields.

export type SpellLanguage = "off" | "en" | "tr";

export interface Settings {
  appearance: {
    fontFamily: string;
    fontSize: number; // px
    lineHeight: number;
    editorWidth: number; // px
  };
  files: {
    autoSaveMs: number;
    recoveryMs: number;
  };
  spellcheck: {
    language: SpellLanguage;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 16,
    lineHeight: 1.7,
    editorWidth: 860,
  },
  files: {
    autoSaveMs: 2000,
    recoveryMs: 3000,
  },
  spellcheck: {
    language: "off",
  },
};

const STORAGE_KEY = "tylike.settings";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function mergeWithDefaults(input: unknown): Settings {
  if (!isObject(input)) return DEFAULT_SETTINGS;
  const a = isObject(input.appearance) ? input.appearance : {};
  const f = isObject(input.files) ? input.files : {};
  const s = isObject(input.spellcheck) ? input.spellcheck : {};
  const lang =
    s.language === "off" || s.language === "en" || s.language === "tr"
      ? s.language
      : DEFAULT_SETTINGS.spellcheck.language;
  return {
    appearance: {
      fontFamily:
        typeof a.fontFamily === "string" && a.fontFamily.trim()
          ? a.fontFamily
          : DEFAULT_SETTINGS.appearance.fontFamily,
      fontSize:
        typeof a.fontSize === "number" && a.fontSize >= 8 && a.fontSize <= 64
          ? a.fontSize
          : DEFAULT_SETTINGS.appearance.fontSize,
      lineHeight:
        typeof a.lineHeight === "number" &&
        a.lineHeight >= 1 &&
        a.lineHeight <= 3
          ? a.lineHeight
          : DEFAULT_SETTINGS.appearance.lineHeight,
      editorWidth:
        typeof a.editorWidth === "number" &&
        a.editorWidth >= 400 &&
        a.editorWidth <= 2000
          ? a.editorWidth
          : DEFAULT_SETTINGS.appearance.editorWidth,
    },
    files: {
      autoSaveMs:
        typeof f.autoSaveMs === "number" &&
        f.autoSaveMs >= 250 &&
        f.autoSaveMs <= 60000
          ? f.autoSaveMs
          : DEFAULT_SETTINGS.files.autoSaveMs,
      recoveryMs:
        typeof f.recoveryMs === "number" &&
        f.recoveryMs >= 250 &&
        f.recoveryMs <= 60000
          ? f.recoveryMs
          : DEFAULT_SETTINGS.files.recoveryMs,
    },
    spellcheck: { language: lang },
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return mergeWithDefaults(JSON.parse(raw));
  } catch (err) {
    logger.warn("loadSettings failed", err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    logger.warn("saveSettings failed", err);
  }
}

export function applyAppearance(s: Settings["appearance"]) {
  const root = document.documentElement;
  root.style.setProperty("--editor-font-family", s.fontFamily);
  root.style.setProperty("--editor-font-size", `${s.fontSize}px`);
  root.style.setProperty("--editor-line-height", `${s.lineHeight}`);
  root.style.setProperty("--editor-width", `${s.editorWidth}px`);
}

export interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  updateAppearance: (patch: Partial<Settings["appearance"]>) => void;
  updateFiles: (patch: Partial<Settings["files"]>) => void;
  updateSpellcheck: (patch: Partial<Settings["spellcheck"]>) => void;
  reset: () => void;
}

export function useSettings(): SettingsApi {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // useLayoutEffect so the CSS variables land before the browser paints —
  // otherwise the editor flashes the fallback font / size on first mount
  // and on every settings change.
  useLayoutEffect(() => {
    applyAppearance(settings.appearance);
    saveSettings(settings);
  }, [settings]);

  const update: SettingsApi["update"] = (patch) => {
    setSettings((prev) => mergeWithDefaults({ ...prev, ...patch }));
  };
  const updateAppearance: SettingsApi["updateAppearance"] = (patch) => {
    setSettings((prev) =>
      mergeWithDefaults({ ...prev, appearance: { ...prev.appearance, ...patch } }),
    );
  };
  const updateFiles: SettingsApi["updateFiles"] = (patch) => {
    setSettings((prev) =>
      mergeWithDefaults({ ...prev, files: { ...prev.files, ...patch } }),
    );
  };
  const updateSpellcheck: SettingsApi["updateSpellcheck"] = (patch) => {
    setSettings((prev) =>
      mergeWithDefaults({
        ...prev,
        spellcheck: { ...prev.spellcheck, ...patch },
      }),
    );
  };
  const reset = () => setSettings(DEFAULT_SETTINGS);

  return {
    settings,
    update,
    updateAppearance,
    updateFiles,
    updateSpellcheck,
    reset,
  };
}
