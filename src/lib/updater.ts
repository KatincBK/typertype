import { check } from "@tauri-apps/plugin-updater";
import { logger } from "./logger";

// MVP-9 — Auto-updater scaffold. Wraps tauri-plugin-updater so the rest
// of the app sees a typed surface and a single place to handle "no
// endpoint configured / network error / dev build" gracefully.
//
// The updater endpoint and pubkey in tauri.conf.json are placeholders —
// real release infrastructure (signed manifest at a stable URL) lands
// alongside MVP-9.x. Until then this resolves to "no update available"
// for any local / unsigned build, which is what we want during dev.

export interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const update = await check();
    if (!update?.available) return null;
    return {
      version: update.version,
      body: update.body ?? null,
      date: update.date ?? null,
    };
  } catch (err) {
    // Silent: a missing / placeholder endpoint or offline state shouldn't
    // pop a scary message at startup. Log so we can debug from the
    // console.
    logger.info("Updater check skipped:", describe(err));
    return null;
  }
}

export async function downloadAndInstallUpdate(
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const update = await check();
    if (!update?.available) {
      return { ok: false, error: "Güncelleme bulunmadı." };
    }
    let downloaded = 0;
    let total: number | null = null;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? null;
          onProgress?.(0, total);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress?.(downloaded, total);
          break;
        case "Finished":
          onProgress?.(total ?? downloaded, total);
          break;
      }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describe(err) };
  }
}

function describe(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
