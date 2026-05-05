import nspell from "nspell";
import { logger } from "./logger";

// dictionary-en/-tr's package.json `exports` field only exposes index.js,
// which means `dictionary-en/index.aff?url` fails to resolve. Reach the
// raw asset via a relative path into node_modules instead — Vite's
// `?url` plugin treats this as a file-system asset import (no package
// resolution), so it bypasses the `exports` restriction.
import enAffUrl from "../../node_modules/dictionary-en/index.aff?url";
import enDicUrl from "../../node_modules/dictionary-en/index.dic?url";
import trAffUrl from "../../node_modules/dictionary-tr/index.aff?url";
import trDicUrl from "../../node_modules/dictionary-tr/index.dic?url";

// FAZ 18 — Pure-JS Hunspell port. Dictionaries are pulled in via
// Vite's `?url` so the .dic / .aff blobs only download on first use of
// each language. The Turkish .dic is ~8.7 MB; English is ~540 KB. Both
// are fetched once per session and cached on the singleton.

export type SpellLang = "en" | "tr";

type Listener = () => void;

const DICT_LOADERS: Record<SpellLang, { aff: string; dic: string }> = {
  en: { aff: enAffUrl, dic: enDicUrl },
  tr: { aff: trAffUrl, dic: trDicUrl },
};

// We keep at most one active language. Switching disposes the previous
// instance so the giant Turkish hash table doesn't linger when the user
// flips back to English.
let currentSpeller: nspell | null = null;
let currentLang: SpellLang | null = null;
let pendingLang: SpellLang | null = null;

const userWords = new Set<string>();
const ignored = new Set<string>();
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      logger.warn("spell listener threw", err);
    }
  }
}

async function buildSpeller(lang: SpellLang): Promise<nspell | null> {
  const loader = DICT_LOADERS[lang];
  try {
    const [aff, dic] = await Promise.all([
      fetch(loader.aff).then((r) => r.text()),
      fetch(loader.dic).then((r) => r.text()),
    ]);
    const speller = nspell(aff, dic);
    // Re-apply any words the user added before the speller was ready.
    for (const w of userWords) speller.add(w);
    return speller;
  } catch (err) {
    logger.error(`spellchecker load (${lang}) failed`, err);
    return null;
  }
}

export function setSpellLanguage(lang: SpellLang | null) {
  pendingLang = lang;
  if (lang === null) {
    currentSpeller = null;
    currentLang = null;
    notify();
    return;
  }
  if (currentLang === lang) return;
  // Drop the old speller eagerly so isReady() flips to false during the
  // transition; otherwise a stale speller would keep flagging words in
  // the wrong language until the new one finishes loading.
  currentSpeller = null;
  currentLang = null;
  notify();
  void buildSpeller(lang).then((speller) => {
    // Honour the latest setLanguage call — if the user switched again
    // mid-load, abandon this result.
    if (pendingLang !== lang) return;
    currentSpeller = speller;
    currentLang = lang;
    notify();
  });
}

export function isSpellReady(): boolean {
  return currentSpeller !== null;
}

export function getSpellLanguage(): SpellLang | null {
  return currentLang;
}

const WORD_RE = /^[\p{L}][\p{L}\p{M}'\-]*[\p{L}]$|^[\p{L}]$/u;

export function checkWord(word: string): boolean {
  if (!currentSpeller) return true; // no engine → never flag
  if (ignored.has(word) || userWords.has(word)) return true;
  if (!WORD_RE.test(word)) return true; // non-word tokens skip
  if (currentSpeller.correct(word)) return true;
  // nspell is case-sensitive — give Sentence-case the same benefit a
  // browser spellcheck does so "Berkay" written mid-sentence isn't
  // flagged just because it's not in the dictionary as-is.
  if (word !== word.toLowerCase()) {
    if (currentSpeller.correct(word.toLowerCase())) return true;
  }
  return false;
}

export function suggestWord(word: string, max = 6): string[] {
  if (!currentSpeller) return [];
  try {
    return currentSpeller.suggest(word).slice(0, max);
  } catch {
    return [];
  }
}

export function addUserWord(word: string) {
  userWords.add(word);
  if (currentSpeller) currentSpeller.add(word);
  notify();
}

export function ignoreWord(word: string) {
  ignored.add(word);
  notify();
}

export function onSpellChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
