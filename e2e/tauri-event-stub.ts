// FAZ 22 (E2E) — companion to tauri-stub.ts for @tauri-apps/api/event.
// Vite aliases @tauri-apps/api/event to this file when E2E=1.
//
// Tests need to drive the file-watcher flow without a real Tauri
// backend, so `listen` keeps a per-event registry and `emit` (plus a
// window-level `__tylikeE2E.emit`) walks it. Renderer code calls
// listen()/emit() unchanged; only the test harness reaches for the
// window helper to push synthetic events through the same path the
// Rust side would normally use.

export type UnlistenFn = () => void;

type Listener = (event: { payload: unknown }) => void;

const LISTENERS: Record<string, Set<Listener>> = {};

export async function listen<T>(
  event: string,
  cb: (e: { payload: T }) => void,
): Promise<UnlistenFn> {
  const set = (LISTENERS[event] ??= new Set());
  set.add(cb as Listener);
  return () => {
    set.delete(cb as Listener);
  };
}

export async function emit(event: string, payload?: unknown): Promise<void> {
  LISTENERS[event]?.forEach((cb) => cb({ payload }));
}

declare global {
  interface Window {
    __tylikeE2E?: {
      initialFile?: string | null;
      files?: Record<string, string>;
      emit?: (event: string, payload?: unknown) => void;
    };
  }
}

if (typeof window !== "undefined") {
  const existing = window.__tylikeE2E ?? {};
  window.__tylikeE2E = {
    ...existing,
    emit: (event: string, payload?: unknown) => {
      LISTENERS[event]?.forEach((cb) => cb({ payload }));
    },
  };
}
