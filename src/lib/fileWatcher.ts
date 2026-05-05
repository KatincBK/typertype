import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { logger } from "./logger";

// FAZ 7 — file watcher front-end wrapper. The Rust side keeps a single
// active watcher; calling watchFile(newPath) replaces (and stops) the
// previous one, so consumers don't have to babysit lifecycle. The Tauri
// event payload carries the new file content directly so the renderer
// doesn't need a follow-up read_text_file round-trip.

export interface FileChangedPayload {
  path: string;
  content: string | null;
  error: string | null;
}

export async function watchFile(path: string): Promise<void> {
  try {
    await invoke<void>("watch_file", { path });
  } catch (err) {
    logger.warn("watch_file failed", err);
  }
}

export async function unwatchFile(): Promise<void> {
  try {
    await invoke<void>("unwatch_file");
  } catch (err) {
    logger.warn("unwatch_file failed", err);
  }
}

export async function onFileChanged(
  handler: (payload: FileChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<FileChangedPayload>("tylike://file-changed", (event) =>
    handler(event.payload),
  );
}
