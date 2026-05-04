import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// MVP-7 — Pandoc-driven export. The Rust side spawns the pandoc binary and
// pipes the markdown over stdin so we don't need to touch the filesystem
// twice (write source, then write output).

export interface PandocCheck {
  available: boolean;
  version?: string;
  error?: string;
}

export async function checkPandoc(): Promise<PandocCheck> {
  try {
    const version = await invoke<string>("check_pandoc");
    return { available: true, version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, error: message };
  }
}

export async function exportViaPandoc(
  markdown: string,
  outputPath: string,
  outputFormat: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await invoke<void>("pandoc_export", {
      markdown,
      outputPath,
      outputFormat,
    });
    return { ok: true };
  } catch (err) {
    logger.error("pandoc_export failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
