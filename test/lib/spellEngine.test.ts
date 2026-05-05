import { beforeAll, describe, expect, it } from "vitest";
import nspell from "nspell";
// dictionary-en's default export is `{aff: Uint8Array, dic: Uint8Array}`
// loaded synchronously via top-level await + node:fs — works directly
// in node-side Vitest, no Vite asset pipeline needed.
import dictionary from "dictionary-en";

// FAZ 22 — direct sanity check on nspell + dictionary-en. The renderer
// path uses Vite's `?url` + fetch to lazy-load the same files; this
// suite skips that layer and validates the underlying engine so a
// dictionary regression surfaces without a browser environment.

let speller: nspell;

beforeAll(() => {
  // dictionary-en exports Uint8Arrays; nspell's typings say
  // string | Buffer, but it accepts buffers and at runtime treats both
  // the same. Wrap as Buffer for the type checker.
  const aff = Buffer.from(dictionary.aff);
  const dic = Buffer.from(dictionary.dic);
  speller = nspell(aff, dic);
});

describe("nspell + dictionary-en", () => {
  it("recognises common English words", () => {
    expect(speller.correct("hello")).toBe(true);
    expect(speller.correct("dictionary")).toBe(true);
  });

  it("flags clear misspellings", () => {
    expect(speller.correct("helo")).toBe(false);
    expect(speller.correct("definatly")).toBe(false);
  });

  it("returns at least one suggestion for a near-miss", () => {
    const suggestions = speller.suggest("helo");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain("hello");
  });

  it("add() makes a word correct on subsequent checks", () => {
    expect(speller.correct("Berkay")).toBe(false);
    speller.add("Berkay");
    expect(speller.correct("Berkay")).toBe(true);
  });
});
