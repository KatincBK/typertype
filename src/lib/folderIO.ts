import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// MVP-3 — folder picker + recursive directory tree wrappers around the
// Rust commands. The shape mirrors the FileEntry struct in src-tauri.

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[] | null;
}

export async function pickFolder(): Promise<string | null> {
  const path = await invoke<string | null>("pick_folder_dialog");
  return path;
}

export async function readDirTree(path: string): Promise<FileEntry> {
  return await invoke<FileEntry>("read_dir_tree", { path });
}

export async function safeReadDirTree(path: string): Promise<FileEntry | null> {
  try {
    return await readDirTree(path);
  } catch (err) {
    logger.error("readDirTree failed", err);
    window.alert("Klasör okunamadı: " + describe(err));
    return null;
  }
}

function describe(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
