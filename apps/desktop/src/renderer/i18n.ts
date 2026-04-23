import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import zhCommon from "./locales/zh/common.json";

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
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});
