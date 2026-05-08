import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import zhCommon from "./locales/zh/common.json";

export const SUPPORTED_LANGUAGE_CODES = ["en", "zh"] as const;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export const I18N_LANGUAGE_STORAGE_KEY = "yishan-language";

function resolveStoredLanguage(): SupportedLanguageCode {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(I18N_LANGUAGE_STORAGE_KEY)?.trim().toLowerCase();
  if (!stored) {
    return "en";
  }

  if (stored.startsWith("zh")) {
    return "zh";
  }
  const base = stored.split(/[-_]/)[0];
  return SUPPORTED_LANGUAGE_CODES.includes(base as SupportedLanguageCode) ? (base as SupportedLanguageCode) : "en";
}

export const resources = {
  en: {
    common: enCommon,
  },
  zh: {
    common: zhCommon,
  },
} as const;

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  resources,
  defaultNS: "common",
  ns: ["common"],
  lng: resolveStoredLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export async function setAppLanguage(languageCode: SupportedLanguageCode): Promise<void> {
  await i18n.changeLanguage(languageCode);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(I18N_LANGUAGE_STORAGE_KEY, languageCode);
  }
}
