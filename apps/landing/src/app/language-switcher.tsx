"use client";

import { type Locale, useI18n } from "@/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center rounded-full border border-[#2A342F] bg-[#151B18] text-xs">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-2.5 py-1 transition ${locale === "en" ? "bg-[#2A342F] text-[#E8ECE8]" : "text-[#A5B0A8] hover:text-[#E8ECE8]"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={`rounded-full px-2.5 py-1 transition ${locale === "zh" ? "bg-[#2A342F] text-[#E8ECE8]" : "text-[#A5B0A8] hover:text-[#E8ECE8]"}`}
      >
        中文
      </button>
    </div>
  );
}
