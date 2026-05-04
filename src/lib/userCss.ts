import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

// MVP-6 — Load the optional custom.css from the Tauri config directory and
// inject it as a <style> tag once at startup. Hot reload could be added
// via a file watcher later; for now the user restarts to apply changes.

const STYLE_ID = "tylike-user-css";

export async function loadUserCss(): Promise<string> {
  try {
    return await invoke<string>("read_user_css");
  } catch (err) {
    logger.warn("read_user_css failed", err);
    return "";
  }
}

export function applyUserCss(css: string) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    // Append last so user CSS wins over our defaults.
    document.head.appendChild(style);
  }
  style.textContent = css;
}
