// FAZ 22 (E2E) — companion to tauri-stub.ts for @tauri-apps/api/event.
// `listen` returns an unsubscribe function and never fires; that's all
// our renderer code needs to stay quiet.

export type UnlistenFn = () => void;

export async function listen<_T>(): Promise<UnlistenFn> {
  return () => undefined;
}

export async function emit(): Promise<void> {
  return;
}
