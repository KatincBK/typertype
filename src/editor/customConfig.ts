import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

// Adım 13 — User-overridable keymap from
// %APPDATA%\Tylike\conf\conf.user.json. The Rust side (`read_user_config`
// in src-tauri/src/lib.rs) returns the file contents or an empty string if
// the file doesn't exist — both treated as "no overrides."
//
// Expected JSON schema:
// {
//   "keymap": {
//     "Mod-Shift-x": "<command-name>",
//     ...
//   }
// }
//
// The command-name strings are matched against a frontend registry below.
// Unknown command names are logged and skipped so a user typo doesn't
// break the editor.

export interface UserConfig {
  keymap: Record<string, string>;
}

export const EMPTY_CONFIG: UserConfig = { keymap: {} };

export async function loadUserConfig(): Promise<UserConfig> {
  try {
    const text = await invoke<string>("read_user_config");
    if (!text || !text.trim()) return EMPTY_CONFIG;
    const parsed = JSON.parse(text) as Partial<UserConfig>;
    return {
      keymap: parsed.keymap ?? {},
    };
  } catch (err) {
    logger.warn("read_user_config failed, falling back to defaults", err);
    return EMPTY_CONFIG;
  }
}
