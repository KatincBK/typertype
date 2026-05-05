import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";

describe("settings", () => {
  it("returns DEFAULT_SETTINGS when localStorage is empty", () => {
    localStorage.clear();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial overrides over defaults", () => {
    localStorage.clear();
    localStorage.setItem(
      "tylike.settings",
      JSON.stringify({ appearance: { fontSize: 22 } }),
    );
    const s = loadSettings();
    expect(s.appearance.fontSize).toBe(22);
    expect(s.appearance.fontFamily).toBe(
      DEFAULT_SETTINGS.appearance.fontFamily,
    );
  });

  it("rejects out-of-range numeric overrides", () => {
    localStorage.clear();
    localStorage.setItem(
      "tylike.settings",
      JSON.stringify({ appearance: { fontSize: 999 } }),
    );
    expect(loadSettings().appearance.fontSize).toBe(
      DEFAULT_SETTINGS.appearance.fontSize,
    );
  });

  it("rejects unknown spellcheck.language values", () => {
    localStorage.clear();
    localStorage.setItem(
      "tylike.settings",
      JSON.stringify({ spellcheck: { language: "ru" } }),
    );
    expect(loadSettings().spellcheck.language).toBe("off");
  });

  it("accepts valid spellcheck.language values", () => {
    localStorage.clear();
    localStorage.setItem(
      "tylike.settings",
      JSON.stringify({ spellcheck: { language: "tr" } }),
    );
    expect(loadSettings().spellcheck.language).toBe("tr");
  });

  it("round-trips through saveSettings", () => {
    localStorage.clear();
    saveSettings({
      ...DEFAULT_SETTINGS,
      files: { autoSaveMs: 5000, recoveryMs: 4000 },
    });
    expect(loadSettings().files).toEqual({
      autoSaveMs: 5000,
      recoveryMs: 4000,
    });
  });
});
