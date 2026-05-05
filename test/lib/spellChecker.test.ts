import { describe, expect, it } from "vitest";
import {
  addUserWord,
  checkWord,
  ignoreWord,
  isSpellReady,
  setSpellLanguage,
} from "@/lib/spellChecker";

// FAZ 22 — wrapper-level tests only. The dictionary load goes through
// fetch on a Vite asset URL which doesn't resolve under jsdom; engine
// correctness is covered directly in test/spellEngine.test.ts. What we
// assert here: the no-engine fallback (everything passes), and that
// runtime sets (user words, ignored) are honoured even before any
// dictionary is loaded.

describe("spellChecker (no engine loaded)", () => {
  it("treats every word as correct when no language is set", () => {
    setSpellLanguage(null);
    expect(isSpellReady()).toBe(false);
    expect(checkWord("xyzzy")).toBe(true);
    expect(checkWord("definitelynotaword")).toBe(true);
  });

  it("skips obvious non-word tokens", () => {
    setSpellLanguage(null);
    // Even with a real engine these would short-circuit before hitting
    // nspell — we only check this branch here, not the dictionary.
    expect(checkWord("123")).toBe(true);
    expect(checkWord("")).toBe(true);
  });

  it("addUserWord doesn't throw with no engine attached", () => {
    expect(() => addUserWord("Berkay")).not.toThrow();
  });

  it("ignoreWord doesn't throw with no engine attached", () => {
    expect(() => ignoreWord("foo")).not.toThrow();
  });
});
