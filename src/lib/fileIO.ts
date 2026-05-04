import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// MVP-2 — thin wrappers around the Rust file-I/O commands. Each function
// either returns the requested data or throws so callers can show a useful
// message in their `catch`.

export interface OpenedFile {
  path: string;
  content: string;
}

export async function openFile(): Promise<OpenedFile | null> {
  const path = await invoke<string | null>("open_file_dialog");
  if (!path) return null;
  const content = await invoke<string>("read_text_file", { path });
  return { path, content };
}

export async function saveFileTo(
  path: string,
  content: string,
): Promise<void> {
  await invoke<void>("write_text_file", { path, content });
}

export async function pickSavePath(
  defaultName?: string,
): Promise<string | null> {
  const path = await invoke<string | null>("save_file_dialog", {
    defaultName: defaultName ?? null,
  });
  return path;
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export async function safeOpenFile(): Promise<OpenedFile | null> {
  try {
    return await openFile();
  } catch (err) {
    logger.error("openFile failed", err);
    window.alert("Dosya açılamadı: " + describe(err));
    return null;
  }
}

export async function safeSaveFile(
  path: string,
  content: string,
): Promise<boolean> {
  try {
    await saveFileTo(path, content);
    return true;
  } catch (err) {
    logger.error("saveFile failed", err);
    window.alert("Dosya kaydedilemedi: " + describe(err));
    return false;
  }
}

export async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await invoke<string>("read_text_file", { path });
  } catch (err) {
    logger.error("readFile failed", err);
    window.alert("Dosya okunamadı: " + describe(err));
    return null;
  }
}

function describe(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
