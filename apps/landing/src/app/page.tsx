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

const pillars = [
  {
    title: "Workspace continuity",
    desc: "Keep context, next steps, and project state attached to the work instead of reconstructing it every session.",
  },
  {
    title: "Local-first execution",
    desc: "Run terminal, git, filesystem, and agent workflows close to the machine where development actually happens.",
  },
  {
    title: "Bring your own agents",
    desc: "Use the CLIs you already trust and let Yishan sit above them as the workspace layer.",
  },
];

const cards = [
  {
    eyebrow: "Context",
    title: "A stable place for work to live",
    desc: "Repos, notes, task context, and execution trails stay aligned so work remains resumable.",
  },
  {
    eyebrow: "Execution",
    title: "Closer to the real dev environment",
    desc: "Yishan is built for actual engineering workflows, not isolated AI chat sessions.",
  },
  {
    eyebrow: "Flow",
    title: "Lower reset cost between sessions",
    desc: "Switch tasks, return later, and keep enough project state to continue without reloading everything into your head.",
  },
];

const workflow = [
  {
    num: "01",
    title: "Open a workspace",
    desc: "Start from a repo, a task, or an existing workstream with a stable home for context.",
  },
  {
    num: "02",
    title: "Connect local execution",
    desc: "Work with your terminal, repo, and preferred agent CLI without replacing your stack.",
  },
  {
    num: "03",
    title: "Resume cleanly",
    desc: "Continue with the current state, recent activity, and next moves already attached to the work.",
  },
];

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 0.5C5.37 0.5 0 5.87 0 12.5C0 17.8 3.44 22.3 8.21 23.89C8.81 24 9.03 23.63 9.03 23.31C9.03 23.02 9.02 22.06 9.02 20.99C5.67 21.72 4.97 19.37 4.97 19.37C4.42 17.97 3.63 17.6 3.63 17.6C2.55 16.86 3.71 16.88 3.71 16.88C4.9 16.96 5.52 18.11 5.52 18.11C6.58 19.93 8.3 19.41 8.97 19.11C9.08 18.34 9.38 17.82 9.71 17.52C7.04 17.22 4.24 16.18 4.24 11.54C4.24 10.22 4.71 9.13 5.48 8.27C5.35 7.97 4.95 6.73 5.6 5.05C5.6 5.05 6.61 4.73 8.99 6.34C9.95 6.07 10.98 5.93 12 5.93C13.02 5.93 14.05 6.07 15.01 6.34C17.39 4.73 18.4 5.05 18.4 5.05C19.05 6.73 18.65 7.97 18.52 8.27C19.29 9.13 19.76 10.22 19.76 11.54C19.76 16.19 16.95 17.22 14.27 17.52C14.69 17.88 15.07 18.58 15.07 19.66C15.07 21.21 15.06 22.47 15.06 23.31C15.06 23.63 15.28 24 15.89 23.89C20.66 22.3 24.1 17.8 24.1 12.5C24.1 5.87 18.73 0.5 12.1 0.5H12Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D1110] text-[#E8ECE8]">
      {/* Background blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-[-10rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[#1B2420]/70 blur-3xl" />
        <div className="absolute right-[-8rem] top-[10rem] h-[24rem] w-[24rem] rounded-full bg-[#18211D]/70 blur-3xl" />
        <div className="absolute left-[30%] top-[22rem] h-[18rem] w-[18rem] rounded-full bg-[#5F8A67]/8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#2A342F] bg-[#0D1110]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Yishan logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-wide text-[#E8ECE8]">Yishan</div>
              <div className="text-xs text-[#A5B0A8]">Workspace layer for agent-driven development</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-[#A5B0A8] md:flex">
            <a href="#pillars" className="transition hover:text-[#E8ECE8]">
              Overview
            </a>
            <a href="#product" className="transition hover:text-[#E8ECE8]">
              Product
            </a>
            <a href="#workflow" className="transition hover:text-[#E8ECE8]">
              Workflow
            </a>
            <a href="https://github.com/yishan-io/yishan-mono/blob/main/CHANGELOG.md" className="transition hover:text-[#E8ECE8]">
              Changelog
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/yishan-io/yishan-mono"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#2A342F] bg-[#151B18] px-4 py-2 text-sm text-[#E8ECE8] transition hover:bg-[#1B2420]"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href="#"
              className="rounded-2xl bg-[#9DDB72] px-4 py-2 text-sm font-medium text-[#0D1110] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(157,219,114,0.22)] transition hover:translate-y-[-1px] hover:bg-[#B2EB8A]"
            >
              Download for macOS
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
              Workspace-first &bull; Local execution &bull; BYO agent CLI
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-[#E8ECE8] md:text-6xl lg:text-7xl">
              A desktop workspace for modern dev flow.
            </h1>

            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-[#2A342F] bg-[#151B18] px-4 py-2 text-sm text-[#A5B0A8]">
              <span className="font-semibold text-[#E8ECE8]">Yishan</span>
              <span className="text-[#8FCB99]">/</span>
              <span>Keep context, execution, and agent workflows in one place</span>
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#A5B0A8] md:text-lg">
              Built for developers who work across repos, terminals, and agent CLIs. Yishan helps reduce reset cost
              between sessions by keeping the right project state close to the work.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href="#"
                className="rounded-2xl bg-[#9DDB72] px-6 py-3 text-sm font-medium text-[#0D1110] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_28px_rgba(157,219,114,0.24)] transition hover:translate-y-[-1px] hover:bg-[#B2EB8A]"
              >
                Download for macOS
              </a>
              <a
                href="https://github.com/yishan-io/yishan-mono"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#2A342F] bg-[#151B18] px-6 py-3 text-sm text-[#E8ECE8] transition hover:bg-[#1B2420]"
              >
                <GitHubIcon />
                View on GitHub
              </a>
            </div>
          </div>

          <div className="mt-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/app.png"
              alt="Yishan desktop app screenshot"
              className="h-auto w-full rounded-lg shadow-[0_32px_100px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]"
            />
          </div>
        </section>

        {/* Agents marquee */}
        <section className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-10">
          <div className="rounded-[32px] border border-[#2A342F] bg-[#121715] p-8 lg:p-10 overflow-hidden">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">Works with agents</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
                Bring your own agent stack.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
                Yishan works alongside the agent tools developers already use, instead of forcing a closed runtime or a
                brand new workflow.
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
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[28px] border border-[#2A342F] bg-[#151B18] p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-[#E8ECE8]">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#A5B0A8]">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Product */}
        <section id="product" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">Product direction</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
              Closer to a real dev environment.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
              Yishan keeps the interface dark and tool-like, aligning the palette with the product identity rather than
              drifting into a separate design system.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {cards.map((card) => (
              <div key={card.title} className="rounded-[28px] border border-[#2A342F] bg-[#151B18] p-6">
                <div className="text-xs uppercase tracking-[0.22em] text-[#D1B06A]">{card.eyebrow}</div>
                <h3 className="mt-4 text-xl font-semibold leading-8 text-[#E8ECE8]">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#A5B0A8]">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-8">
          <div className="rounded-[36px] border border-[#2A342F] bg-[#121715] px-8 py-10 text-[#E8ECE8] lg:px-10">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">Workflow</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
                Keep real development work moving.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
                Yishan is designed for multi-step engineering work that needs context, execution, and continuity to stay
                connected.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {workflow.map((item) => (
                <div key={item.num} className="rounded-[28px] border border-[#2A342F] bg-[#151B18] p-6">
                  <div className="text-sm font-medium text-[#D1B06A]">{item.num}</div>
                  <h3 className="mt-4 text-xl font-semibold text-[#E8ECE8]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#A5B0A8]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-20 lg:px-8">
          <div className="flex flex-col gap-8 rounded-[36px] border border-[#2A342F] bg-[#151B18] p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.24em] text-[#A5B0A8]">Get started</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#E8ECE8] md:text-4xl">
                Built for developers who want less fragmentation.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#A5B0A8]">
                Keep context closer to the work, make sessions more resumable, and let agent workflows fit real project
                environments.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <a
                href="#"
                className="rounded-2xl bg-[#9DDB72] px-6 py-3 text-sm font-medium text-[#0D1110] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_28px_rgba(157,219,114,0.24)] transition hover:translate-y-[-1px] hover:bg-[#B2EB8A]"
              >
                Download for macOS
              </a>
              <a
                href="https://github.com/yishan-io/yishan-mono"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#2A342F] bg-[#151B18] px-6 py-3 text-sm text-[#E8ECE8] transition hover:bg-[#1B2420]"
              >
                <GitHubIcon />
                View on GitHub
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
                <div className="text-xs text-[#A5B0A8]">Workspace layer for agent-driven development</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#A5B0A8]">
              Built for developers who want less fragmentation, lower reset cost, and a calmer way to work with agents.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#A5B0A8]">Product</div>
              <div className="mt-4 space-y-3 text-sm text-[#A5B0A8]">
                <a href="#pillars" className="block transition hover:text-[#E8ECE8]">
                  Overview
                </a>
                <a href="#product" className="block transition hover:text-[#E8ECE8]">
                  Product
                </a>
                <a href="#workflow" className="block transition hover:text-[#E8ECE8]">
                  Workflow
                </a>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#A5B0A8]">Links</div>
              <div className="mt-4 space-y-3 text-sm text-[#A5B0A8]">
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  Download for macOS
                </a>
                <a href="https://github.com/yishan-io/yishan-mono" className="block transition hover:text-[#E8ECE8]">
                  GitHub
                </a>
                <a href="https://github.com/yishan-io/yishan-mono/blob/main/CHANGELOG.md" className="block transition hover:text-[#E8ECE8]">
                  Changelog
                </a>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#A5B0A8]">Company</div>
              <div className="mt-4 space-y-3 text-sm text-[#A5B0A8]">
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  About
                </a>
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  Contact
                </a>
                <a href="#" className="block transition hover:text-[#E8ECE8]">
                  Privacy
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2A342F]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 text-sm text-[#A5B0A8] lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>&copy; 2026 Yishan. All rights reserved.</div>
            <div>Make development work feel lighter.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
