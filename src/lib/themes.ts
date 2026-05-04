import { useEffect, useState } from "react";

// MVP-6 — Theme preference is what the user picked from the dropdown;
// `effective` resolves "auto" to the live OS preference. Components only
// care about effective; we apply it via the data-theme attribute on the
// app shell so CSS variables in App.css cascade through everything.

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
