import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// MVP-9 — wrapper around the Rust `get_initial_args` command. The Rust
// side captures argv before Tauri parses it, so a `tylike file.md`
// invocation or a .md double-click on Windows lands here.

export interface InitialArgs {
  file: string | null;
}

export async function getInitialArgs(): Promise<InitialArgs> {
  try {
    return await invoke<InitialArgs>("get_initial_args");
  } catch (err) {
    logger.warn("get_initial_args failed", err);
    return { file: null };
  }
}
