import { invoke } from "@tauri-apps/api/core";
import i18n from "./i18n";
import { logger } from "./logger";

function describe(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

// FAZ 11 — Thin wrappers around the three Rust image commands. Each
// returns the path that should land in the markdown source: relative
// (e.g. "foo.assets/bar.png") when the doc has a path on disk, absolute
// (under app_data_dir/assets) when the doc is still untitled.

export async function pickImage(): Promise<string | null> {
  try {
    return await invoke<string | null>("pick_image_dialog");
  } catch (err) {
    logger.warn("pick_image_dialog failed", err);
    return null;
  }
}

export async function copyImageToAssets(
  sourcePath: string,
  docPath: string | null,
): Promise<string | null> {
  try {
    return await invoke<string>("copy_image_to_assets", {
      sourcePath,
      docPath,
    });
  } catch (err) {
    logger.error("copy_image_to_assets failed", err);
    window.alert(i18n.t("errors.copyImage", { detail: describe(err) }));
    return null;
  }
}

export async function writeImageBytes(
  bytes: Uint8Array,
  extension: string,
  docPath: string | null,
): Promise<string | null> {
  try {
    // Tauri serializes Vec<u8> as a JSON array; convert via Array.from.
    return await invoke<string>("write_image_bytes", {
      bytes: Array.from(bytes),
      extension,
      docPath,
    });
  } catch (err) {
    logger.error("write_image_bytes failed", err);
    window.alert(i18n.t("errors.writeImage", { detail: describe(err) }));
    return null;
  }
}
