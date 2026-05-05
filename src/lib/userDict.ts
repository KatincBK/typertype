import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// FAZ 18 (B) — user dictionary persistence. Read once on startup,
// rewritten as a flat list every time a word is added. There's no
// "remove from user dict" UI yet but the file is plain JSON the user
// can edit by hand.

let cached: string[] | null = null;

export async function loadUserDict(): Promise<string[]> {
  try {
    const words = await invoke<string[]>("read_user_dict");
    cached = words;
    return words;
  } catch (err) {
    logger.warn("read_user_dict failed", err);
    cached = [];
    return [];
  }
}

export async function persistUserDict(word: string): Promise<void> {
  if (cached === null) cached = [];
  if (cached.includes(word)) return;
  cached.push(word);
  try {
    await invoke<void>("write_user_dict", { words: cached });
  } catch (err) {
    logger.warn("write_user_dict failed", err);
  }
}
