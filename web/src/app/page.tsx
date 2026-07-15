"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const SPECIMEN = [
  {
    title: "Senior code reviewer",
    body: "You are a senior code reviewer. For each diff I paste, list correctness bugs first, then security issues, then style nits. Cite line numbers. Be terse.",
    tags: ["code-review", "dev"],
    vis: "public" as const,
    uses: 214,
  },
  {
    title: "Cold email that gets replies",
    body: "Write a 4-sentence cold email. Sentence 1 names something specific about their company. Sentence 2 states the problem…",
    tags: ["sales"],
    vis: "team" as const,
    uses: 87,
  },
  {
    title: "Explain like I'm a junior",
    body: "Explain this concept assuming I know Python but nothing about the domain. Use one concrete example, no analogies to cooking.",
    tags: ["learning"],
    vis: "private" as const,
    uses: 31,
  },
];

const VIS_COLOR = {
  public: "text-ink",
  team: "text-amber",
  private: "text-dim",
};

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          "[data-hero] > *",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.09 },
        )
        .fromTo(
          "[data-specimen]",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.55 },
          "-=0.35",
        )
        .fromTo(
          "[data-specimen-row]",
          { opacity: 0 },
          { opacity: 1, duration: 0.3, stagger: 0.08 },
          "-=0.2",
        );
    },
    { scope: root },
  );

  const copySpecimen = (idx: number, body: string) => {
    void navigator.clipboard.writeText(body);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
  };

  return (
    <div ref={root} className="min-h-screen overflow-x-clip">
      {/* top-nav — 64px, canvas, wordmark left, actions right */}
      <header>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="font-display text-[22px] font-light tracking-tight">
            Prompt Diary
          </span>
          <nav className="flex items-center gap-2 text-[15px]">
            <Link
              href="/gallery"
              className="rounded-full px-3.5 py-2 font-medium text-ink transition-colors hover:bg-hover"
            >
              Gallery
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-line-strong px-4 py-2 font-medium text-ink transition-colors hover:bg-hover"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-accent px-4 py-2 font-medium text-white transition-colors hover:bg-accent-deep"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* hero band — centered display headline over atmospheric orbs */}
        <section className="relative pb-16 pt-20 text-center md:pb-24 md:pt-28">
          {/* pure atmosphere: pastel gradient orbs, never containing content */}
          <div aria-hidden className="absolute inset-0 -z-10">
            <div
              className="orb orb-drift left-[8%] top-[10%] h-72 w-72"
              style={{ background: "radial-gradient(circle, #a7e5d3 0%, transparent 70%)" }}
            />
            <div
              className="orb orb-drift-late right-[10%] top-[4%] h-80 w-80"
              style={{ background: "radial-gradient(circle, #f4c5a8 0%, transparent 70%)" }}
            />
            <div
              className="orb orb-drift bottom-[0%] left-[38%] h-64 w-64"
              style={{ background: "radial-gradient(circle, #c8b8e0 0%, transparent 70%)" }}
            />
          </div>

          <div data-hero className="mx-auto max-w-3xl">
            <h1 className="font-display text-[40px] font-light leading-[1.05] tracking-[-0.03em] [text-wrap:balance] md:text-[64px]">
              Your best prompts, kept.
            </h1>
            <p className="mx-auto mt-6 max-w-[52ch] text-[16px] leading-relaxed text-body">
              The prompt that finally worked is twenty scrolls deep in last
              week&apos;s chat. Prompt Diary is a password manager for prompts —
              save from any page, organize, sync, and share on your terms.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-deep"
              >
                Start your diary
              </Link>
              <Link
                href="/gallery"
                className="rounded-full border border-line-strong px-5 py-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-hover"
              >
                Browse the gallery
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-dim">
              Free · works offline · your private prompts never leave your vault
            </p>
          </div>

          {/* the product, not a screenshot of it — click a row, it copies */}
          <div
            data-specimen
            className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-2xl border border-line bg-raised text-left shadow-soft"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs font-medium text-dim">
                the diary · try clicking a row
              </span>
              <span className="font-display text-sm font-light italic">Pd</span>
            </div>
            <div className="divide-y divide-line">
              {SPECIMEN.map((s, i) => (
                <button
                  key={s.title}
                  data-specimen-row
                  className="block w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-hover"
                  onClick={() => copySpecimen(i, s.body)}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="flex-1 truncate text-sm font-medium">
                      {s.title}
                    </span>
                    {copiedIdx === i && (
                      <span className="text-xs font-semibold text-success">
                        Copied ✓
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 block font-mono text-xs leading-relaxed text-body">
                    {s.body}
                  </span>
                  <span className="mt-2 flex items-center gap-3">
                    <span className={`vis-badge ${VIS_COLOR[s.vis]}`}>{s.vis}</span>
                    {s.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto text-xs tabular-nums text-dim">
                      {s.uses}×
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* the flow, told as diary entries — display serif heads, hairline rules */}
        <section className="border-t border-line">
          <div className="grid gap-x-16 border-b border-line py-14 md:grid-cols-[16rem_1fr]">
            <h2 className="font-display text-[32px] font-light leading-[1.13] tracking-[-0.01em]">
              Save
            </h2>
            <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-body md:mt-2">
              Highlight the prompt in ChatGPT, Claude, or anywhere else →
              right-click → <span className="font-medium text-ink">Save to Prompt Diary</span>.
              It&apos;s in your vault before the reply finishes streaming. No
              account needed — the extension is a full offline vault on its own.
            </p>
          </div>
          <div className="grid gap-x-16 border-b border-line py-14 md:grid-cols-[16rem_1fr]">
            <h2 className="font-display text-[32px] font-light leading-[1.13] tracking-[-0.01em]">
              Find it again
            </h2>
            <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-body md:mt-2">
              Folders, tags, pins, search — then one click to copy it back into
              any chat. The diary keeps count of what you actually reuse, so
              your best material rises.
            </p>
          </div>
          <div className="grid gap-x-16 py-14 md:grid-cols-[16rem_1fr]">
            <h2 className="font-display text-[32px] font-light leading-[1.13] tracking-[-0.01em]">
              Share on your terms
            </h2>
            <div className="mt-3 space-y-4 md:mt-2">
              <p className="max-w-prose text-[16px] leading-relaxed text-body">
                Every prompt has a dial, and it starts fully closed:
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span>
                  <span className="vis-badge text-dim">private</span>
                  <span className="ml-2 text-body">only you, ever</span>
                </span>
                <span>
                  <span className="vis-badge text-amber">team</span>
                  <span className="ml-2 text-body">your team&apos;s shared library</span>
                </span>
                <span>
                  <span className="vis-badge text-ink">public</span>
                  <span className="ml-2 text-body">open-source it to the gallery</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* cta band — centered display head, single ink pill */}
        <section className="relative border-t border-line py-24 text-center">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div
              className="orb orb-drift-late left-[30%] top-[15%] h-56 w-56"
              style={{ background: "radial-gradient(circle, #a8c8e8 0%, transparent 70%)" }}
            />
            <div
              className="orb orb-drift right-[28%] top-[30%] h-48 w-48"
              style={{ background: "radial-gradient(circle, #e8b8c4 0%, transparent 70%)" }}
            />
          </div>
          <h2 className="font-display text-[36px] font-light leading-[1.17] tracking-[-0.01em] [text-wrap:balance]">
            Stop losing your best prompts.
          </h2>
          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-deep"
          >
            Start your diary
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-10 text-[15px] text-body">
          <span className="font-display font-light italic">Prompt Diary</span>
          <span className="flex items-center gap-5">
            <Link href="/gallery" className="hover:text-ink">
              Gallery
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <span className="text-dim">Local-first. Open at heart.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
