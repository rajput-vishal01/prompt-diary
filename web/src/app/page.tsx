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
  public: "text-accent",
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
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
        )
        .fromTo(
          "[data-specimen-row]",
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.35, stagger: 0.07 },
          "-=0.25",
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
    <div ref={root} className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl italic">
            Prompt <span className="text-accent">Diary</span>
          </span>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/gallery" className="text-dim hover:text-ink">
              Gallery
            </Link>
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* hero: copy left, living specimen right */}
        <section className="grid items-center gap-12 py-16 md:grid-cols-[1fr_1.1fr] md:py-24">
          <div data-hero>
            <h1 className="font-display text-5xl font-medium leading-[1.08] [text-wrap:balance] md:text-6xl">
              Your best prompts, <em className="text-accent">kept</em>.
            </h1>
            <p className="mt-6 max-w-[44ch] leading-relaxed text-dim">
              The prompt that finally worked is twenty scrolls deep in last
              week's chat. Prompt Diary is a password manager for prompts —
              save from any page, organize, sync, and share on your terms.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link href="/login" className="btn-primary px-5 py-2.5">
                Start your diary
              </Link>
              <Link href="/gallery" className="btn px-5 py-2.5">
                Browse the gallery
              </Link>
            </div>
            <p className="mt-4 text-xs text-dim">
              Free · works offline · your private prompts never leave your vault
            </p>
          </div>

          {/* the product, not a screenshot of it — click a row, it copies */}
          <div className="overflow-hidden rounded-[10px] border border-line bg-raised shadow-[0_1px_2px_rgba(19,39,30,0.06)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold text-dim">
                the-ledger · try clicking a row
              </span>
              <span className="font-display text-sm italic text-accent">Pd</span>
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
                    <span className="flex-1 truncate text-sm font-semibold">
                      {s.title}
                    </span>
                    {copiedIdx === i && (
                      <span className="text-xs font-bold text-accent">
                        Copied ✓
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 block font-mono text-xs leading-relaxed text-dim">
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

        {/* the flow, told as ledger entries — not a feature grid */}
        <section className="border-t border-line">
          <div className="grid gap-x-12 border-b border-line py-10 md:grid-cols-[14rem_1fr]">
            <h2 className="font-display text-2xl italic text-accent">Save</h2>
            <p className="mt-2 max-w-prose leading-relaxed text-dim md:mt-1">
              Highlight the prompt in ChatGPT, Claude, or anywhere else →
              right-click → <span className="text-ink">Save to Prompt Diary</span>.
              It's in your vault before the reply finishes streaming. No
              account needed — the extension is a full offline vault on its own.
            </p>
          </div>
          <div className="grid gap-x-12 border-b border-line py-10 md:grid-cols-[14rem_1fr]">
            <h2 className="font-display text-2xl italic text-accent">Find it again</h2>
            <p className="mt-2 max-w-prose leading-relaxed text-dim md:mt-1">
              Folders, tags, pins, search — then one click to copy it back into
              any chat. The diary keeps count of what you actually reuse, so
              your best material rises.
            </p>
          </div>
          <div className="grid gap-x-12 py-10 md:grid-cols-[14rem_1fr]">
            <h2 className="font-display text-2xl italic text-accent">
              Share on your terms
            </h2>
            <div className="mt-2 space-y-3 md:mt-1">
              <p className="max-w-prose leading-relaxed text-dim">
                Every prompt has a dial, and it starts fully closed:
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span>
                  <span className="vis-badge text-dim">private</span>
                  <span className="ml-2 text-dim">only you, ever</span>
                </span>
                <span>
                  <span className="vis-badge text-amber">team</span>
                  <span className="ml-2 text-dim">your team's shared library</span>
                </span>
                <span>
                  <span className="vis-badge text-accent">public</span>
                  <span className="ml-2 text-dim">open-source it to the gallery</span>
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-xs text-dim">
          <span className="font-display italic">Prompt Diary</span>
          <span>Local-first. Open at heart.</span>
        </div>
      </footer>
    </div>
  );
}
