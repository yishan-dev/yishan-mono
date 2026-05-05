"use client";

import { useI18n } from "@/i18n";
import { DownloadButton } from "./download-button";
import { HeroImage } from "./hero-image";
import { LanguageSwitcher } from "./language-switcher";

const logoUrl =
  "https://raw.githubusercontent.com/yishan-io/yishan-mono/main/apps/desktop/src/assets/images/yishan-transparent.png";

const agents: { name: string; icon: string; size?: string }[] = [
  { name: "OpenCode", icon: "/opencode.svg" },
  { name: "Codex", icon: "/codex.svg", size: "h-7 w-7" },
  { name: "Claude", icon: "/claude.svg" },
  { name: "Gemini", icon: "/gemini.svg" },
  { name: "Cursor", icon: "/cursor.svg" },
  { name: "Pi", icon: "/pi.svg" },
];

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 0.5C5.37 0.5 0 5.87 0 12.5C0 17.8 3.44 22.3 8.21 23.89C8.81 24 9.03 23.63 9.03 23.31C9.03 23.02 9.02 22.06 9.02 20.99C5.67 21.72 4.97 19.37 4.97 19.37C4.42 17.97 3.63 17.6 3.63 17.6C2.55 16.86 3.71 16.88 3.71 16.88C4.9 16.96 5.52 18.11 5.52 18.11C6.58 19.93 8.3 19.41 8.97 19.11C9.08 18.34 9.38 17.82 9.71 17.52C7.04 17.22 4.24 16.18 4.24 11.54C4.24 10.22 4.71 9.13 5.48 8.27C5.35 7.97 4.95 6.73 5.6 5.05C5.6 5.05 6.61 4.73 8.99 6.34C9.95 6.07 10.98 5.93 12 5.93C13.02 5.93 14.05 6.07 15.01 6.34C17.39 4.73 18.4 5.05 18.4 5.05C19.05 6.73 18.65 7.97 18.52 8.27C19.29 9.13 19.76 10.22 19.76 11.54C19.76 16.19 16.95 17.22 14.27 17.52C14.69 17.88 15.07 18.58 15.07 19.66C15.07 21.21 15.06 22.47 15.06 23.31C15.06 23.63 15.28 24 15.89 23.89C20.66 22.3 24.1 17.8 24.1 12.5C24.1 5.87 18.73 0.5 12.1 0.5H12Z" />
    </svg>
  );
}

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0D1110] text-[#E8ECE8]">
      {/* Background blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-[-10rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[#1B2420]/70 blur-3xl" />
        <div className="absolute right-[-8rem] top-[10rem] h-[24rem] w-[24rem] rounded-full bg-[#18211D]/70 blur-3xl" />
        <div className="absolute left-[30%] top-[22rem] h-[18rem] w-[18rem] rounded-full bg-[#5F8A67]/8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#2A342F] bg-[#0D1110]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-1">
            <div className="flex h-20 w-20 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Yishan logo" className="h-full w-full object-contain" />
            </div>
            <div className="text-lg font-semibold tracking-wide text-[#E8ECE8]">Yishan</div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-[#A5B0A8] md:flex">
            <a href="#pillars" className="transition hover:text-[#E8ECE8]">
              {t("nav.overview")}
            </a>
            <a href="#product" className="transition hover:text-[#E8ECE8]">
              {t("nav.product")}
            </a>
            <a href="#workflow" className="transition hover:text-[#E8ECE8]">
              {t("nav.workflow")}
            </a>
            <a href="https://github.com/yishan-io/yishan-mono/blob/main/CHANGELOG.md" className="transition hover:text-[#E8ECE8]">
              {t("nav.changelog")}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a
              href="https://github.com/yishan-io/yishan-mono"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#2A342F] bg-[#151B18] px-4 py-2 text-sm text-[#E8ECE8] transition hover:bg-[#1B2420]"
            >
              <GitHubIcon />
              {t("nav.github")}
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2A342F] bg-[#151B18] px-3 py-1 text-xs text-[#D1B06A]">
              {t("hero.badge")}
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-[#E8ECE8] md:text-6xl lg:text-7xl">
              {t("hero.title")}
            </h1>

            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-[#2A342F] bg-[#151B18] px-4 py-2 text-sm text-[#A5B0A8]">
              <span className="font-semibold text-[#E8ECE8]">Yishan</span>
              <span className="text-[#8FCB99]">/</span>
              <span>{t("hero.tagline")}</span>
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#A5B0A8] md:text-lg">
              {t("hero.desc")}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <DownloadButton />
              <a
                href="https://github.com/yishan-io/yishan-mono"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#2A342F] bg-[#151B18] px-6 py-3 text-sm text-[#E8ECE8] transition hover:bg-[#1B2420]"
              >
                <GitHubIcon />
                {t("hero.github")}
              </a>
            </div>
          </div>

          <HeroImage />
        </section>

        {/* Agents marquee */}
        <section className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-10">
          <div className="rounded-[32px] border border-[#2A342F] bg-[#121715] p-8 lg:p-10 overflow-hidden">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">{t("agents.label")}</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
                {t("agents.title")}
              </h2>
              <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
                {t("agents.desc")}
              </p>
            </div>

            <div className="mt-8 relative -mx-8 px-8 lg:-mx-10 lg:px-10">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#121715] to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#121715] to-transparent z-10" />

              <div className="flex gap-4 whitespace-nowrap animate-marquee w-max">
                {[...agents, ...agents].map((agent, idx) => (
                  <div
                    key={`${agent.name}-${idx}`}
                    className="inline-flex items-center gap-3 rounded-full border border-[#2A342F] bg-[#151B18] px-5 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2A342F] bg-[#0F1412]">
                      <div
                        className={`${agent.size ?? "h-5 w-5"} bg-[#D1B06A]`}
                        style={{ mask: `url(${agent.icon}) center/contain no-repeat`, WebkitMask: `url(${agent.icon}) center/contain no-repeat` }}
                        aria-label={agent.name}
                      />
                    </div>
                    <div className="text-sm font-medium text-[#E8ECE8]">{agent.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section id="pillars" className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[28px] border border-[#2A342F] bg-[#151B18] p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-[#E8ECE8]">{t(`pillars.${i}.title`)}</h3>
                <p className="mt-3 text-sm leading-7 text-[#A5B0A8]">{t(`pillars.${i}.desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Product */}
        <section id="product" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">{t("product.label")}</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
              {t("product.title")}
            </h2>
            <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
              {t("product.desc")}
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[28px] border border-[#2A342F] bg-[#151B18] p-6">
                <div className="text-xs uppercase tracking-[0.22em] text-[#D1B06A]">{t(`cards.${i}.eyebrow`)}</div>
                <h3 className="mt-4 text-xl font-semibold leading-8 text-[#E8ECE8]">{t(`cards.${i}.title`)}</h3>
                <p className="mt-3 text-sm leading-7 text-[#A5B0A8]">{t(`cards.${i}.desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-8">
          <div className="rounded-[36px] border border-[#2A342F] bg-[#121715] px-8 py-10 text-[#E8ECE8] lg:px-10">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">{t("workflow.label")}</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
                {t("workflow.title")}
              </h2>
              <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
                {t("workflow.desc")}
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[28px] border border-[#2A342F] bg-[#151B18] p-6">
                  <div className="text-sm font-medium text-[#D1B06A]">{`0${i + 1}`}</div>
                  <h3 className="mt-4 text-xl font-semibold text-[#E8ECE8]">{t(`workflow.${i}.title`)}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#A5B0A8]">{t(`workflow.${i}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-20 lg:px-8">
          <div className="flex flex-col gap-8 rounded-[36px] border border-[#2A342F] bg-[#151B18] p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">{t("cta.label")}</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
                {t("cta.title")}
              </h2>
              <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
                {t("cta.desc")}
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <DownloadButton />
              <a
                href="https://github.com/yishan-io/yishan-mono"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#2A342F] bg-[#151B18] px-6 py-3 text-sm text-[#E8ECE8] transition hover:bg-[#1B2420]"
              >
                <GitHubIcon />
                {t("cta.github")}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A342F] bg-[#0F1412]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-start lg:justify-between lg:px-8">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Yishan logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="text-base font-semibold tracking-wide text-[#E8ECE8]">Yishan</div>
                <div className="text-xs text-[#A5B0A8]">{t("footer.tagline")}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#A5B0A8]">
              {t("footer.desc")}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#A5B0A8]">{t("footer.product")}</div>
              <div className="mt-4 space-y-3 text-sm text-[#A5B0A8]">
                <a href="#pillars" className="block transition hover:text-[#E8ECE8]">
                  {t("nav.overview")}
                </a>
                <a href="#product" className="block transition hover:text-[#E8ECE8]">
                  {t("nav.product")}
                </a>
                <a href="#workflow" className="block transition hover:text-[#E8ECE8]">
                  {t("nav.workflow")}
                </a>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#A5B0A8]">{t("footer.links")}</div>
              <div className="mt-4 space-y-3 text-sm text-[#A5B0A8]">
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  {t("footer.download")}
                </a>
                <a href="https://github.com/yishan-io/yishan-mono" className="block transition hover:text-[#E8ECE8]">
                  GitHub
                </a>
                <a href="https://github.com/yishan-io/yishan-mono/blob/main/CHANGELOG.md" className="block transition hover:text-[#E8ECE8]">
                  {t("nav.changelog")}
                </a>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#A5B0A8]">{t("footer.company")}</div>
              <div className="mt-4 space-y-3 text-sm text-[#A5B0A8]">
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  {t("footer.about")}
                </a>
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  {t("footer.contact")}
                </a>
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  {t("footer.privacy")}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2A342F]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 text-sm text-[#A5B0A8] lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>{t("footer.copyright")}</div>
            <div>{t("footer.slogan")}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
