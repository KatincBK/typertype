import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import tr from "@/locales/tr.json";
import en from "@/locales/en.json";

// FAZ 19 — i18n bootstrap. Strings live as nested-object JSON keyed
// by area (header, settings, find, spell, image, common). The active
// language is driven by the user's setting via App.tsx — defaults to
// Turkish to match the current shipped UI.

export type AppLanguage = "tr" | "en";

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: "tr",
  fallbackLng: "tr",
  interpolation: { escapeValue: false },
  // Keep returned values plain strings; we never want React nodes
  // accidentally treated as such by translations.
  returnNull: false,
});

export function setAppLanguage(lang: AppLanguage) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export default i18n;
