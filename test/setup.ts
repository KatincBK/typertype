import { vi } from "vitest";

// FAZ 22 — global Tauri shims. The renderer modules import from
// @tauri-apps/api/core and @tauri-apps/api/event; under jsdom there's
// no IPC bridge so we replace the surface with deterministic mocks.
// Individual tests can override these via vi.mocked(invoke).mockImplementation.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
  // Used by the image NodeView. Echo the path so resolveImageSrc tests
  // can assert on a stable transformation.
  convertFileSrc: (p: string) => `tauri://localhost/${p}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));
