import {
  inputRules,
  smartQuotes,
  ellipsis,
} from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";
import { smartyPantsRules } from "./smartypants";

// Inline mark conversions live in the live-format plugin.
// Block-level conversions live in blockEnter.ts (Adım 3).
// This file only contains SmartyPants-style substitutions safe to fire
// mid-typing (Adım 6): smartQuotes, ellipsis, and our own dash/symbol rules.
export function buildInputRules(_schema: Schema) {
  return inputRules({
    rules: [...smartQuotes, ellipsis, ...smartyPantsRules],
  });
}
