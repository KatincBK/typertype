import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// MVP-5 — crash-recovery snapshot. The Rust side persists JSON in
// app_config_dir; this module is the only place that touches the wire
// format. Field names are camelCase on the wire because the Rust struct
// declares #[serde(rename_all = "camelCase")].

export interface RecoverySnapshot {
  filePath: string | null;
  content: string;
  savedAt: string; // ISO 8601
}

export async function writeRecovery(
  filePath: string | null,
  content: string,
): Promise<void> {
  const snapshot: RecoverySnapshot = {
    filePath,
    content,
    savedAt: new Date().toISOString(),
  };
  try {
    await invoke<void>("write_recovery", { snapshot });
  } catch (err) {
    // Best-effort: a failed snapshot shouldn't disrupt typing. Log and
    // move on.
    logger.warn("writeRecovery failed", err);
  }
}

export async function readRecovery(): Promise<RecoverySnapshot | null> {
  try {
    return await invoke<RecoverySnapshot | null>("read_recovery");
  } catch (err) {
    logger.warn("readRecovery failed", err);
    return null;
  }
}

export async function clearRecovery(): Promise<void> {
  try {
    await invoke<void>("clear_recovery");
  } catch (err) {
    logger.warn("clearRecovery failed", err);
  }
}
