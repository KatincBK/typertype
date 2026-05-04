// MVP-5 — Most-recently-used file list. Stored in localStorage so it
// persists across sessions without needing a Tauri command. Cap is 10.

const KEY = "tylike.recentFiles";
const MAX = 10;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // localStorage may be disabled (e.g. private mode); ignore silently.
  }
}

export function getRecents(): string[] {
  return read();
}

export function addRecent(path: string) {
  if (!path) return;
  const cur = read();
  const filtered = cur.filter((p) => p !== path);
  filtered.unshift(path);
  write(filtered);
}

export function removeRecent(path: string) {
  const cur = read();
  write(cur.filter((p) => p !== path));
}
