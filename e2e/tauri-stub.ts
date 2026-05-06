// FAZ 22 (E2E) — Tauri-API stand-in for Playwright runs against the
// plain Vite dev server. Vite aliases @tauri-apps/api/core and
// @tauri-apps/api/event to this file when E2E=1, so renderer code that
// imports `invoke` / `listen` keeps compiling without any conditional
// branches in the app source.

const HANDLERS: Record<string, (args?: Record<string, unknown>) => unknown> = {
  // The launchArgs path looks for `file: string | null`; null → recovery
  // / sample flow runs without trying to open a real file.
  get_initial_args: () => ({ file: null }),
  // Recovery snapshot: pretend there's nothing to restore.
  read_recovery: () => null,
  // User dictionary: empty list keeps spell-check off by default.
  read_user_dict: () => [],
  // Best-effort defaults for the rest — e2e tests assert UI behaviour,
  // not file-system side effects.
  read_user_config: () => "",
  read_user_css: () => "",
  read_text_file: () => "",
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
