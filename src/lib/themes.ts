import { useEffect, useLayoutEffect, useState } from "react";

// MVP-6 — Theme preference is what the user picked from the dropdown;
// `effective` resolves "auto" to the live OS preference. The hook puts
// `data-theme` directly on <html> so the CSS variables cascade into
// <body>, <#root>, and every descendant — putting it on the app shell
// instead leaves <body>'s background stuck on the light fallback.

export type ThemePreference = "auto" | "light" | "dark" | "sepia";
export type EffectiveTheme = "light" | "dark" | "sepia";

const STORAGE_KEY = "tylike.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "auto" || raw === "light" || raw === "dark" || raw === "sepia") {
      return raw;
    }
  } catch {
    // localStorage may be unavailable; fall back to auto.
  }
  return "auto";
}

function readSystemDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export interface ThemeApi {
  preference: ThemePreference;
  effective: EffectiveTheme;
  setPreference: (next: ThemePreference) => void;
}

export function useTheme(): ThemeApi {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    readStoredPreference,
  );
  const [systemDark, setSystemDark] = useState<boolean>(readSystemDark);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(DARK_QUERY);
    } catch {
      return;
    }
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const effective: EffectiveTheme =
    preference === "auto" ? (systemDark ? "dark" : "light") : preference;

  // Sync the data-theme attribute onto <html> before paint so the page
  // never flashes the light fallback on mount or when the user toggles
  // the system theme.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", effective);
  }, [effective]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / disabled storage
    }
  };

  return { preference, effective, setPreference };
}
