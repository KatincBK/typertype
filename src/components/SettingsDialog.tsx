import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  type Settings,
  type SettingsApi,
} from "@/lib/settings";
import {
  getConfigPaths,
  openThemesDir,
  openUserConfig,
  type ConfigPaths,
} from "@/lib/configPaths";
import { logger } from "@/lib/logger";

// MVP-8 — Settings modal. Live-update: every input change is applied to
// CSS variables (for appearance) or to the Settings ref reads (for file
// timings) immediately. The dialog itself is just three small forms — no
// "Save" button needed because there's nothing to commit.

interface Props {
  open: boolean;
  api: SettingsApi;
  onClose: () => void;
}

type Tab = "appearance" | "files" | "spellcheck" | "advanced";

const FONT_PRESETS: Array<{ label: string; value: string }> = [
  {
    label: "Sistem (sans-serif)",
    value:
      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  { label: "Inter / sans-serif", value: 'Inter, system-ui, sans-serif' },
  { label: "Georgia (serif)", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Consolas (mono)", value: 'Consolas, "Courier New", monospace' },
];

function findPresetIndex(value: string): number {
  return FONT_PRESETS.findIndex((p) => p.value === value);
}

export function SettingsDialog({ open, api, onClose }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("appearance");
  const [paths, setPaths] = useState<ConfigPaths | null>(null);

  useEffect(() => {
    if (!open) return;
    void getConfigPaths().then(setPaths);
  }, [open]);

  // Esc to close — uses keydown so it wins over the editor's own handlers.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  const {
    settings,
    updateAppearance,
    updateFiles,
    updateSpellcheck,
    updateApp,
    reset,
  } = api;

  return (
    <div className="settings-overlay" onMouseDown={onClose}>
      <div
        className="settings-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-header">
          <h2 id="settings-title">{t("settings.title")}</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            title={`${t("common.close")} (Esc)`}
          >
            ×
          </button>
        </header>
        <nav className="settings-tabs">
          <TabButton
            id="appearance"
            label={t("settings.tabs.appearance")}
            tab={tab}
            setTab={setTab}
          />
          <TabButton
            id="files"
            label={t("settings.tabs.files")}
            tab={tab}
            setTab={setTab}
          />
          <TabButton
            id="spellcheck"
            label={t("settings.tabs.spellcheck")}
            tab={tab}
            setTab={setTab}
          />
          <TabButton
            id="advanced"
            label={t("settings.tabs.advanced")}
            tab={tab}
            setTab={setTab}
          />
        </nav>
        <div className="settings-body">
          {tab === "appearance" ? (
            <AppearanceTab
              settings={settings.appearance}
              update={updateAppearance}
              appLanguage={settings.app.language}
              updateApp={updateApp}
            />
          ) : null}
          {tab === "files" ? (
            <FilesTab settings={settings.files} update={updateFiles} />
          ) : null}
          {tab === "spellcheck" ? (
            <SpellcheckTab
              settings={settings.spellcheck}
              update={updateSpellcheck}
            />
          ) : null}
          {tab === "advanced" ? <AdvancedTab paths={paths} /> : null}
        </div>
        <footer className="settings-footer">
          <button
            type="button"
            className="settings-btn-secondary"
            onClick={() => {
              if (window.confirm(t("settings.footer.resetConfirm"))) reset();
            }}
          >
            {t("settings.footer.reset")}
          </button>
          <button
            type="button"
            className="settings-btn-primary"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TabButton({
  id,
  label,
  tab,
  setTab,
}: {
  id: Tab;
  label: string;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <button
      type="button"
      className={`settings-tab${tab === id ? " is-active" : ""}`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );
}

function AppearanceTab({
  settings,
  update,
  appLanguage,
  updateApp,
}: {
  settings: Settings["appearance"];
  update: (patch: Partial<Settings["appearance"]>) => void;
  appLanguage: Settings["app"]["language"];
  updateApp: (patch: Partial<Settings["app"]>) => void;
}) {
  const { t } = useTranslation();
  const presetIndex = findPresetIndex(settings.fontFamily);
  return (
    <>
      <Field label={t("settings.appearance.language")}>
        <select
          value={appLanguage}
          onChange={(e) =>
            updateApp({
              language: e.target.value as Settings["app"]["language"],
            })
          }
        >
          <option value="tr">{t("settings.appearance.languageTr")}</option>
          <option value="en">{t("settings.appearance.languageEn")}</option>
        </select>
      </Field>
      <p className="settings-hint">{t("settings.appearance.languageHint")}</p>
      <Field label={t("settings.appearance.fontPreset")}>
        <select
          value={presetIndex >= 0 ? String(presetIndex) : "custom"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") return;
            const p = FONT_PRESETS[Number(v)];
            if (p) update({ fontFamily: p.value });
          }}
        >
          {FONT_PRESETS.map((p, i) => (
            <option key={p.value} value={String(i)}>
              {p.label}
            </option>
          ))}
          <option value="custom">— Custom —</option>
        </select>
      </Field>
      <Field label={t("settings.appearance.fontCustom")}>
        <input
          type="text"
          value={settings.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          placeholder={t("settings.appearance.fontPlaceholder")}
        />
      </Field>
      <Field
        label={t("settings.appearance.fontSize", { size: settings.fontSize })}
      >
        <input
          type="range"
          min={10}
          max={32}
          value={settings.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
        />
      </Field>
      <Field
        label={t("settings.appearance.lineHeight", {
          value: settings.lineHeight.toFixed(2),
        })}
      >
        <input
          type="range"
          min={1.2}
          max={2.5}
          step={0.05}
          value={settings.lineHeight}
          onChange={(e) => update({ lineHeight: Number(e.target.value) })}
        />
      </Field>
      <Field
        label={t("settings.appearance.editorWidth", {
          value: settings.editorWidth,
        })}
      >
        <input
          type="range"
          min={520}
          max={1400}
          step={20}
          value={settings.editorWidth}
          onChange={(e) => update({ editorWidth: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function FilesTab({
  settings,
  update,
}: {
  settings: Settings["files"];
  update: (patch: Partial<Settings["files"]>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field
        label={t("settings.files.autoSaveDelay", {
          seconds: (settings.autoSaveMs / 1000).toFixed(1),
        })}
      >
        <input
          type="range"
          min={500}
          max={10000}
          step={250}
          value={settings.autoSaveMs}
          onChange={(e) => update({ autoSaveMs: Number(e.target.value) })}
        />
      </Field>
      <p className="settings-hint">{t("settings.files.autoSaveHint")}</p>
      <Field
        label={t("settings.files.recoveryDelay", {
          seconds: (settings.recoveryMs / 1000).toFixed(1),
        })}
      >
        <input
          type="range"
          min={500}
          max={10000}
          step={250}
          value={settings.recoveryMs}
          onChange={(e) => update({ recoveryMs: Number(e.target.value) })}
        />
      </Field>
      <p className="settings-hint">{t("settings.files.recoveryHint")}</p>

      <div className="settings-section-break">
        <h3 className="settings-section-title">
          {t("settings.files.fileAssoc.title")}
        </h3>
        <p className="settings-hint">
          {t("settings.files.fileAssoc.description")}
        </p>
        <div className="settings-row">
          <button
            type="button"
            className="settings-btn-secondary"
            onClick={() =>
              void openUrl("ms-settings:defaultapps").catch((err) =>
                logger.warn("openUrl(ms-settings) failed:", err),
              )
            }
          >
            {t("settings.files.fileAssoc.openWindowsSettings")}
          </button>
        </div>
      </div>
    </>
  );
}

function SpellcheckTab({
  settings,
  update,
}: {
  settings: Settings["spellcheck"];
  update: (patch: Partial<Settings["spellcheck"]>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field label={t("settings.spellcheck.language")}>
        <select
          value={settings.language}
          onChange={(e) =>
            update({
              language: e.target.value as Settings["spellcheck"]["language"],
            })
          }
        >
          <option value="off">{t("settings.spellcheck.off")}</option>
          <option value="en">{t("settings.spellcheck.en")}</option>
          <option value="tr">{t("settings.spellcheck.tr")}</option>
        </select>
      </Field>
      <p className="settings-hint">{t("settings.spellcheck.hint")}</p>
    </>
  );
}

function AdvancedTab({ paths }: { paths: ConfigPaths | null }) {
  const { t } = useTranslation();
  return (
    <div className="settings-advanced">
      <p className="settings-hint">{t("settings.advanced.intro")}</p>
      <div className="settings-row">
        <button
          type="button"
          className="settings-btn-secondary"
          onClick={() => void openUserConfig()}
        >
          {t("settings.advanced.openConfig")}
        </button>
        {paths ? (
          <code className="settings-path" title={paths.userConfigFile}>
            {paths.userConfigFile}
          </code>
        ) : null}
      </div>
      <div className="settings-row">
        <button
          type="button"
          className="settings-btn-secondary"
          onClick={() => void openThemesDir()}
        >
          {t("settings.advanced.openThemes")}
        </button>
        {paths ? (
          <code className="settings-path" title={paths.themesDir}>
            {paths.themesDir}
          </code>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      {children}
    </label>
  );
}
