"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";

type Platform = "mac-arm" | "mac-intel" | "linux-appimage" | "linux-deb" | "linux-rpm";

interface PlatformInfo {
  key: Platform;
  label: string;
  labelZh: string;
  url: string;
}

const REPO = "https://github.com/yishan-io/yishan-mono/releases/latest/download";

const platforms: PlatformInfo[] = [
  { key: "mac-arm", label: "macOS (Apple Silicon)", labelZh: "macOS (Apple Silicon)", url: `${REPO}/Yishan-arm64.dmg` },
  { key: "mac-intel", label: "macOS (Intel)", labelZh: "macOS (Intel)", url: `${REPO}/Yishan-x64.dmg` },
  { key: "linux-appimage", label: "Linux (AppImage)", labelZh: "Linux (AppImage)", url: `${REPO}/Yishan-x86_64.AppImage` },
  { key: "linux-deb", label: "Linux (.deb)", labelZh: "Linux (.deb)", url: `${REPO}/yishan_amd64.deb` },
  { key: "linux-rpm", label: "Linux (.rpm)", labelZh: "Linux (.rpm)", url: `${REPO}/yishan-x86_64.rpm` },
];

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "mac-arm";

  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();

  if (ua.includes("mac") || platform.includes("mac")) {
    // Detect Apple Silicon via WebGL renderer or platform hint
    // navigator.userAgentData is available in some browsers
    const uaData = (navigator as unknown as { userAgentData?: { architecture?: string } }).userAgentData;
    if (uaData?.architecture === "arm") return "mac-arm";
    // Fallback: newer Macs are mostly ARM
    return "mac-arm";
  }

  if (ua.includes("linux") || platform.includes("linux")) {
    return "linux-appimage";
  }

  // Default to macOS ARM
  return "mac-arm";
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5v-2z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

export function DownloadButton({ variant = "primary" }: { variant?: "primary" | "compact" }) {
  const { locale } = useI18n();
  const [detected, setDetected] = useState<Platform>("mac-arm");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDetected(detectPlatform());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = platforms.find((p) => p.key === detected) ?? platforms[0]!;
  const label = locale === "zh" ? current.labelZh : current.label;
  const downloadLabel = locale === "zh" ? "下载" : "Download";

  const isPrimary = variant === "primary";

  return (
    <div ref={ref} className="relative inline-flex">
      <a
        href={current.url}
        className={
          isPrimary
            ? "inline-flex items-center gap-2 rounded-l-2xl bg-[#9DDB72] px-6 py-3 text-sm font-medium text-[#0D1110] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_28px_rgba(157,219,114,0.24)] transition hover:translate-y-[-1px] hover:bg-[#B2EB8A]"
            : "inline-flex items-center gap-2 rounded-l-2xl bg-[#9DDB72] px-4 py-2 text-sm font-medium text-[#0D1110] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(157,219,114,0.22)] transition hover:translate-y-[-1px] hover:bg-[#B2EB8A]"
        }
      >
        <DownloadIcon />
        {downloadLabel} {label}
      </a>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          isPrimary
            ? "inline-flex items-center rounded-r-2xl border-l border-[#7BC054] bg-[#9DDB72] px-2.5 py-3 text-[#0D1110] transition hover:bg-[#B2EB8A]"
            : "inline-flex items-center rounded-r-2xl border-l border-[#7BC054] bg-[#9DDB72] px-2 py-2 text-[#0D1110] transition hover:bg-[#B2EB8A]"
        }
      >
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 min-w-[200px] rounded-xl border border-[#2A342F] bg-[#151B18] p-1 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
          {platforms.map((p) => (
            <a
              key={p.key}
              href={p.url}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                p.key === detected ? "bg-[#2A342F] text-[#E8ECE8]" : "text-[#A5B0A8] hover:bg-[#1B2420] hover:text-[#E8ECE8]"
              }`}
            >
              {locale === "zh" ? p.labelZh : p.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
