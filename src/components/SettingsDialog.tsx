import { useEffect, useState } from "react";
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

// MVP-8 — Settings modal. Live-update: every input change is applied to
// CSS variables (for appearance) or to the Settings ref reads (for file
// timings) immediately. The dialog itself is just three small forms — no
// "Save" button needed because there's nothing to commit.

interface Props {
  open: boolean;
  api: SettingsApi;
  onClose: () => void;
}

type Tab = "appearance" | "files" | "advanced";

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

  const { settings, updateAppearance, updateFiles, reset } = api;

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
          <h2 id="settings-title">Ayarlar</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            title="Kapat (Esc)"
          >
            ×
          </button>
        </header>
        <nav className="settings-tabs">
          <TabButton id="appearance" label="Görünüm" tab={tab} setTab={setTab} />
          <TabButton id="files" label="Dosya" tab={tab} setTab={setTab} />
          <TabButton id="advanced" label="Gelişmiş" tab={tab} setTab={setTab} />
        </nav>
        <div className="settings-body">
          {tab === "appearance" ? (
            <AppearanceTab
              settings={settings.appearance}
              update={updateAppearance}
            />
          ) : null}
          {tab === "files" ? (
            <FilesTab settings={settings.files} update={updateFiles} />
          ) : null}
          {tab === "advanced" ? <AdvancedTab paths={paths} /> : null}
        </div>
        <footer className="settings-footer">
          <button
            type="button"
            className="settings-btn-secondary"
            onClick={() => {
              if (window.confirm("Tüm ayarlar varsayılana dönecek. Devam?"))
                reset();
            }}
          >
            Varsayılana Sıfırla
          </button>
          <button
            type="button"
            className="settings-btn-primary"
            onClick={onClose}
          >
            Kapat
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
}: {
  settings: Settings["appearance"];
  update: (patch: Partial<Settings["appearance"]>) => void;
}) {
  const presetIndex = findPresetIndex(settings.fontFamily);
  return (
    <>
      <Field label="Font ailesi (hazır)">
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
          <option value="custom">— Özel —</option>
        </select>
      </Field>
      <Field label="Font ailesi (CSS)">
        <input
          type="text"
          value={settings.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          placeholder="örn. Inter, system-ui, sans-serif"
        />
      </Field>
      <Field label={`Font boyutu — ${settings.fontSize}px`}>
        <input
          type="range"
          min={10}
          max={32}
          value={settings.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Satır yüksekliği — ${settings.lineHeight.toFixed(2)}`}>
        <input
          type="range"
          min={1.2}
          max={2.5}
          step={0.05}
          value={settings.lineHeight}
          onChange={(e) => update({ lineHeight: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Editör genişliği — ${settings.editorWidth}px`}>
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
  return (
    <>
      <Field
        label={`Otomatik kaydetme gecikmesi — ${(settings.autoSaveMs / 1000).toFixed(1)}s`}
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
      <p className="settings-hint">
        Düzenleme durduktan sonra dosyaya yazılana kadar geçen süre
        (yalnızca diske kaydedilmiş dosyalar).
      </p>
      <Field
        label={`Kurtarma anlık görüntüsü gecikmesi — ${(settings.recoveryMs / 1000).toFixed(1)}s`}
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
      <p className="settings-hint">
        Kaydedilmemiş içerik için kurtarma dosyasına yazma sıklığı.
      </p>
    </>
  );
}

function AdvancedTab({ paths }: { paths: ConfigPaths | null }) {
  return (
    <div className="settings-advanced">
      <p className="settings-hint">
        Gelişmiş ayarlar JSON / CSS dosyaları üzerinden yönetilir.
        Düzenleyince uygulamayı yeniden başlatın.
      </p>
      <div className="settings-row">
        <button
          type="button"
          className="settings-btn-secondary"
          onClick={() => void openUserConfig()}
        >
          Konfig dosyasını aç (conf.user.json)
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
          Tema klasörünü aç (themes/custom.css)
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
