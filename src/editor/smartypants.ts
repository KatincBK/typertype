import { InputRule } from "prosemirror-inputrules";

// Adım 6 — Typora SmartyPants substitutions.
// Order matters: longer / chained patterns must come first so they match
// before the simpler ones (e.g. en-dash + hyphen → em-dash before -- → en-dash).
export const smartyPantsRules: InputRule[] = [
  new InputRule(/–-$/, "—"),
  new InputRule(/--$/, "–"),
  new InputRule(/\(c\)$/i, "©"),
  new InputRule(/\(r\)$/i, "®"),
  new InputRule(/\(tm\)$/i, "™"),
  new InputRule(/\+-$/, "±"),
  new InputRule(/<<$/, "«"),
  new InputRule(/>>$/, "»"),
];
