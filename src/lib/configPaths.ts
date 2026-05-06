import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import i18n from "./i18n";
import { logger } from "./logger";

function describe(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

// MVP-8 — surface the well-known config paths and offer one-click "open in
// default editor / file manager" actions for the Settings dialog. Each
// command also makes sure the file/dir exists so the user doesn't get a
// "file not found" prompt when clicking Open.

export interface ConfigPaths {
  configDir: string;
  userConfigFile: string;
  themesDir: string;
  themesCustomCss: string;
}

export async function getConfigPaths(): Promise<ConfigPaths | null> {
  try {
    return await invoke<ConfigPaths>("get_config_paths");
  } catch (err) {
    logger.warn("get_config_paths failed", err);
    return null;
  }
}

export async function openUserConfig(): Promise<void> {
  try {
    const path = await invoke<string>("ensure_user_config_exists");
    await openPath(path);
  } catch (err) {
    logger.error("openUserConfig failed", err);
    window.alert(i18n.t("errors.openConfig", { detail: describe(err) }));
  }
}

export async function openThemesDir(): Promise<void> {
  try {
    const dir = await invoke<string>("ensure_themes_dir_exists");
    await openPath(dir);
  } catch (err) {
    logger.error("openThemesDir failed", err);
    window.alert(i18n.t("errors.openThemes", { detail: describe(err) }));
  }
}
