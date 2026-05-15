#!/usr/bin/env node
// MVP-9 follow-up — generate the Tauri updater manifest (latest.json)
// from a freshly-built Windows bundle. Tauri's updater fetches this
// file from the configured endpoint, compares versions, and verifies
// the signature against the pubkey baked into the binary.
//
// Inputs (env):
//   TYPERTYPE_VERSION         — version tag without leading "v" (e.g. 0.2.0)
//   TYPERTYPE_NSIS_PATH       — path to the .exe NSIS installer
//   TYPERTYPE_NSIS_SIG_PATH   — path to the .exe.sig file produced by Tauri
//   TYPERTYPE_DOWNLOAD_BASE   — public URL prefix the installer is published
//                            under (e.g. https://github.com/USER/REPO/
//                            releases/download/v0.2.0)
//   TYPERTYPE_RELEASE_NOTES   — optional notes string (defaults to version)
//
// Tauri will produce TYPERTYPE_NSIS_SIG_PATH automatically when the build
// runs with TAURI_SIGNING_PRIVATE_KEY + TAURI_SIGNING_PRIVATE_KEY_PASSWORD
// in the environment. Without those two, no .sig is emitted and this
// script intentionally fails — the whole point of latest.json is the
// signature, so a missing one is a misconfiguration, not a soft-fail.

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

function need(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`release-manifest: missing required env ${key}`);
    process.exit(1);
  }
  return v;
}

const version = need("TYPERTYPE_VERSION").replace(/^v/, "");
const installer = need("TYPERTYPE_NSIS_PATH");
const sigFile = need("TYPERTYPE_NSIS_SIG_PATH");
const downloadBase = need("TYPERTYPE_DOWNLOAD_BASE").replace(/\/+$/, "");
const notes = process.env.TYPERTYPE_RELEASE_NOTES ?? `Typertype ${version}`;

statSync(installer); // throws if missing — fail loudly, not silently
const signature = readFileSync(sigFile, "utf8").trim();
if (!signature) {
  console.error(`release-manifest: signature file ${sigFile} is empty`);
  process.exit(1);
}

const installerName = basename(installer);
const url = `${downloadBase}/${encodeURIComponent(installerName)}`;

const manifest = {
  version,
  notes,
  // Tauri reads the timestamp via Date.parse; ISO-8601 keeps it portable.
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      url,
      signature,
    },
  },
};

const out = process.argv[2] ?? "latest.json";
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`release-manifest: wrote ${out}`);
