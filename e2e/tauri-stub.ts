// FAZ 22 (E2E) — Tauri-API stand-in for Playwright runs against the
// plain Vite dev server. Vite aliases @tauri-apps/api/core and
// @tauri-apps/api/event to this file when E2E=1, so renderer code that
// imports `invoke` / `listen` keeps compiling without any conditional
// branches in the app source.
//
// Tests can preconfigure renderer state via `window.__tylikeE2E`
// (set with page.addInitScript). `initialFile` flows through
// get_initial_args ⇒ launchArgs ⇒ loadFile, and `files` backs
// read_text_file responses.

const HANDLERS: Record<string, (args?: Record<string, unknown>) => unknown> = {
  get_initial_args: () => ({
    file: window.__tylikeE2E?.initialFile ?? null,
  }),
  read_recovery: () => null,
  read_user_dict: () => [],
  read_user_config: () => "",
  read_user_css: () => "",
  read_text_file: (args) => {
    const path = String(args?.path ?? "");
    return window.__tylikeE2E?.files?.[path] ?? "";
  },
  write_text_file: () => undefined,
  write_recovery: () => undefined,
  clear_recovery: () => undefined,
  watch_file: () => undefined,
  unwatch_file: () => undefined,
  write_user_dict: () => undefined,
};

export async function invoke<T = unknown>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const handler = HANDLERS[command];
  if (!handler) {
    // eslint-disable-next-line no-console
    console.warn(`[tauri-stub] unhandled invoke: ${command}`, args);
    return undefined as T;
  }
  return handler(args) as T;
}

export function convertFileSrc(path: string): string {
  return `tauri-stub://${path}`;
}
