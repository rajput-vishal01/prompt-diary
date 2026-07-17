"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { ArrowRight, ArrowUp } from "lucide-react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// ---------------------------------------------------------------- data

const MENU_LINKS = [
  { label: "Home", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: "Sign in", href: "/login" },
  { label: "Start free", href: "/login" },
  { label: "Privacy", href: "/privacy" },
];

// pastel washes behind the glass mocks — decoration only, never component fills
const ORB_WASHES = ["bg-orb-mint", "bg-orb-peach", "bg-orb-lavender", "bg-orb-sky"];

const MARQUEE_SITES = [
  "ChatGPT", "Claude", "Gemini", "Perplexity", "Poe", "DeepSeek",
  "Grok", "Copilot", "Le Chat", "Kimi", "Qwen", "Meta AI",
];

const CAPABILITIES = [
  {
    title: "Folders, tags & facets",
    note: "organize",
    preview: "Folders like bookmarks, tags like labels — plus computed style facets (few-shot, chain-of-thought, role-play, template) detected from the text itself.",
  },
  {
    title: "Command palette",
    note: "⌘K",
    preview: "Search prompts, folders and actions from anywhere in the dashboard. Enter copies, shift-enter opens.",
  },
  {
    title: "Public gallery",
    note: "share",
    preview: "Publish a prompt open-source. Browse the community's, bookmark the good ones, add them to your diary in one click.",
  },
  {
    title: "Share pages",
    note: "/p · /r",
    preview: "Every public prompt and recipe gets a clean page anyone can read — no account needed. Private steps stay redacted.",
  },
  {
    title: "Teams & spend",
    note: "together",
    preview: "Shared prompt libraries with roles, plus a usage dashboard: daily trends, member leaderboard, and per-model spend.",
  },
  {
    title: "Offline-first sync",
    note: "everywhere",
    preview: "The extension is a full vault on its own — no account required. Sign in and it follows you across devices, last write wins.",
  },
];

// ---------------------------------------------------------------- mockups
// the product drawn in CSS — no stock screenshots

function PopupMock() {
  return (
    <div className="glass w-64 rounded-xl p-3">
      <div className="flex h-8 items-center rounded-lg border border-line-strong bg-white/50 px-2.5 text-xs text-dim">
        rewrite in my voice…
        <span className="kbd ml-auto">↵</span>
      </div>
      {["Editorial rewrite pass", "Bug report normalizer", "Launch email v3"].map((t, i) => (
        <div key={t} className={`mt-1.5 rounded-lg px-2.5 py-2 ${i === 0 ? "bg-white/70 shadow-[inset_2px_0_0_#0c0a09]" : ""}`}>
          <p className="truncate text-xs font-medium text-ink">{t}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-dim">Rewrite the following in a tighter…</p>
        </div>
      ))}
    </div>
  );
}

function ThreadMock() {
  return (
    <div className="glass w-64 rounded-xl p-3">
      <p className="px-1 text-xs font-medium text-ink">Launch email recipe</p>
      {["Draft the angle", "Tighten the hook", "Final subject lines"].map((t, i) => (
        <div key={t} className="mt-1.5 flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-2">
          <span className="font-mono text-[10px] tabular-nums text-dim">{String(i + 1).padStart(2, "0")}</span>
          <span className="truncate text-xs text-ink">{t}</span>
        </div>
      ))}
      <div className="mt-1.5 rounded-lg bg-white/45 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-dim">
        final output ↓
      </div>
    </div>
  );
}

function TransferMock() {
  return (
    <div className="glass flex w-64 flex-col items-center gap-2 rounded-xl p-4">
      <div className="flex w-full items-center justify-between">
        <span className="chip">ChatGPT · 14 messages</span>
        <ArrowRight size={14} className="text-dim" />
        <span className="chip">Claude</span>
      </div>
      <div className="w-full rounded-lg bg-white/60 p-2.5 font-mono text-[10px] leading-relaxed text-dim">
        [Context from a previous conversation]
        <br />User: draft the pricing page…
        <br />Assistant: here&apos;s the structure…
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-success">continues where you left off</span>
    </div>
  );
}

function WidgetMock() {
  return (
    <div className="glass w-56 rounded-xl p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-display italic">Pd</span>
        <span className="text-dim">ChatGPT · 3h</span>
        <span className="ml-auto tabular-nums text-dim">11/15</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-tint">
        <div className="h-full w-3/4 rounded-full bg-amber" />
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-amber">
        Thinking <span className="ml-auto tabular-nums">3/5 · 24h</span>
      </div>
      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-[#f7ead6]">
        <div className="h-full w-3/5 rounded-full bg-amber" />
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: "Save from anywhere",
    body: "Select text on any AI site and it's in your vault before the reply finishes streaming. Launcher popup, Alt+P, one keystroke to paste it back.",
    mock: <PopupMock />,
  },
  {
    title: "Threads are recipes",
    body: "Not transcripts — the ordered chain of prompts that produced one great result. Record as you work, replay any time, shelve them into projects.",
    mock: <ThreadMock />,
  },
  {
    title: "Carry the context",
    body: "Deep in a chat but want a different model? Capture the conversation and continue it on another AI, exactly where you left off.",
    mock: <TransferMock />,
  },
  {
    title: "Know your limits",
    body: "A quiet on-page meter estimates your sends against each model's caps — thinking modes tracked separately, because one Max message isn't one message.",
    mock: <WidgetMock />,
  },
];

// ---------------------------------------------------------------- page

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoverCap, setHoverCap] = useState<number | null>(null);

  // Lenis smooth scroll — the 412 signature feel (1.2s, exponential ease-out)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenisRef.current = lenis;
    let raf = requestAnimationFrame(function loop(time) {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    });
    lenis.on("scroll", ScrollTrigger.update);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // header hides scrolling down, returns scrolling up — and materializes as
  // glass once it leaves the hero's top edge
  useEffect(() => {
    const header = document.getElementById("pd-header");
    if (!header) return;
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      header.style.transform = y > last && y > 120 ? "translateY(-100%)" : "translateY(0)";
      setScrolled(y > 32); // no-op re-render unless the boolean flips
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // menu overlay: stop the page under it, stagger the links in
  useEffect(() => {
    const lenis = lenisRef.current;
    if (menuOpen) {
      lenis?.stop();
      document.body.style.overflow = "hidden";
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(
          ".menu-link",
          { y: 48, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: "power3.out", delay: 0.1 },
        );
      }
    } else {
      lenis?.start();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // hero lines rise out of overflow-hidden wrappers
      gsap.from(".hero-line", {
        yPercent: 110,
        duration: 0.9,
        stagger: 0.12,
        ease: "power4.out",
        delay: 0.15,
      });
      gsap.from("[data-hero-sub] > *", {
        opacity: 0,
        y: 16,
        duration: 0.6,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.7,
      });
      // generic scroll reveals
      gsap.utils.toArray<HTMLElement>(".st-reveal").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 32,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        });
      });
      // the manifesto line reveals word by word at 80% in view
      gsap.from(".quote-word", {
        opacity: 0.12,
        stagger: 0.06,
        duration: 0.4,
        ease: "none",
        scrollTrigger: { trigger: "[data-quote]", start: "top 80%", end: "top 40%", scrub: true },
      });
    },
    { scope: root },
  );

  const toTop = () => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.5 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const quote = "The prompt that finally worked is an asset. Treat it like one.".split(" ");

  return (
    <div ref={root} className="min-h-screen overflow-x-clip bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* ---------- header: fixed; becomes Ink Glass chrome once scrolled ----------
          the glass fill keeps ink text legible over light AND dark bands —
          the material does the work the old mix-blend-difference trick did */}
      <header
        id="pd-header"
        className="fixed inset-x-0 top-0 z-50 px-4 transition-transform duration-300 ease-out md:px-6"
      >
        <div
          className={`mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full py-2.5 transition-[background-color,border-color,box-shadow,padding-left,padding-right,color] duration-300 ease-out ${
            menuOpen
              ? "px-5 text-bg"
              : scrolled
                ? "glass px-5 text-ink"
                : "border border-transparent px-2 text-ink"
          }`}
        >
          <Link href="/" className="font-display text-[22px] font-light tracking-tight">
            Prompt Diary
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="hidden rounded-full border border-current px-4 py-1.5 text-sm font-medium transition-[opacity,transform] duration-150 hover:opacity-70 active:scale-[0.97] md:block"
            >
              Start free
            </Link>
            <button
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className={`pd-burger ${menuOpen ? "open" : ""}`}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* ---------- menu overlay: dark glass — the page glows through it ---------- */}
      <div
        className={`glass-ink fixed inset-0 z-40 flex flex-col justify-center rounded-none border-0 px-8 transition-opacity duration-300 md:px-16 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1">
          {MENU_LINKS.map((l, i) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="menu-link group flex items-baseline gap-4 py-1"
            >
              <span className="font-mono text-xs tabular-nums text-bg/40">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-display text-[11vw] font-light uppercase leading-[1.02] tracking-[-0.02em] text-bg transition-opacity group-hover:opacity-60 md:text-[5.5vw]">
                {l.label}
              </span>
            </Link>
          ))}
        </nav>
        <p className="mt-10 max-w-sm text-sm leading-relaxed text-bg/50">
          A password manager for prompts. Save, organize, sync, and share — on your terms.
        </p>
      </div>

      {/* ---------- hero ---------- */}
      <section className="relative flex min-h-[94vh] flex-col justify-center px-6 pt-28 md:px-10">
        {/* blurred glow word — pastel atmosphere, never a component fill */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <span
            className="pd-glow-word select-none bg-gradient-to-br from-orb-mint via-orb-peach to-orb-lavender bg-clip-text font-display text-[42vw] font-light italic leading-none text-transparent"
          >
            Pd
          </span>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <h1 className="font-display font-light uppercase leading-[0.96] tracking-[-0.03em]">
            {["Your best", "prompts,", "kept."].map((line) => (
              <span key={line} className="block overflow-hidden">
                <span className="hero-line block text-[clamp(52px,10vw,96px)]">{line}</span>
              </span>
            ))}
          </h1>

          <div data-hero-sub className="relative mt-8 max-w-xl">
            {/* margin note — editorial annotation in the writer's hand */}
            <p
              aria-hidden
              className="absolute -top-14 right-0 hidden -rotate-6 font-display text-xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.15))] md:block lg:-right-40"
            >
              like a password manager — for prompts
            </p>
            <p className="text-[17px] leading-relaxed text-body">
              The prompt that finally worked is twenty scrolls deep in last week&apos;s
              chat. Save it from any AI site, organize it, reuse it in one keystroke,
              and carry whole conversations between models.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn-primary px-6 py-3 text-[15px]">
                Start your diary
              </Link>
              <Link href="/gallery" className="btn px-6 py-3 text-[15px]">
                Browse the gallery
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-dim">
              Free · works offline · your private prompts never leave your vault
            </p>
          </div>
        </div>
      </section>

      {/* ---------- marquee: every model we ride along with ---------- */}
      <section className="overflow-hidden border-y border-line py-5" aria-label="Supported AI sites">
        <div className="pd-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
              {MARQUEE_SITES.map((s) => (
                <span key={`${copy}-${s}`} className="flex items-center font-mono text-xs uppercase tracking-[0.14em] text-dim">
                  <span className="px-6">{s}</span>
                  <span className="text-line-strong">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- cinematic band: the idea, spelled large ---------- */}
      <section className="relative overflow-hidden bg-ink px-6 py-28 text-bg md:px-10 md:py-40">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-orb-lavender/20 blur-[150px]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-orb-peach/20 blur-[150px]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="st-reveal relative">
            <span
              aria-hidden
              className="absolute -top-10 left-2 -rotate-6 font-display text-2xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.6))]"
            >
              the vault
            </span>
            <p className="font-display text-[clamp(40px,7vw,88px)] font-light uppercase leading-[1.02] tracking-[-0.02em]">
              Save the prompt.
            </p>
          </div>

          <div className="st-reveal relative mt-6 md:ml-[14%]">
            <p className="font-display text-[clamp(40px,7vw,88px)] font-light uppercase leading-[1.02] tracking-[-0.02em]">
              Keep the{" "}
              <span className="relative inline-block">
                recipe.
                <svg aria-hidden viewBox="0 0 100 20" className="absolute -bottom-3 left-0 w-full text-amber" preserveAspectRatio="none">
                  <path d="M0 10 Q 50 0 100 15" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </p>
            <span
              aria-hidden
              className="absolute -right-4 -top-8 -rotate-12 font-display text-xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.6))] md:right-[18%]"
            >
              recipes, not transcripts
            </span>
          </div>

          <div className="st-reveal relative mt-6 md:ml-[6%]">
            <svg aria-hidden viewBox="0 0 100 100" className="absolute -left-12 top-3 hidden h-9 w-9 text-bg/30 md:block">
              <path d="M25 25 L75 75 M75 25 L25 75" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>
            <p className="font-display text-[clamp(40px,7vw,88px)] font-light uppercase leading-[1.02] tracking-[-0.02em]">
              Carry the context.
            </p>
            <span
              aria-hidden
              className="absolute -bottom-9 left-6 -rotate-3 font-display text-xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.6))]"
            >
              no more twenty scrolls deep
            </span>
          </div>

          <p className="st-reveal mt-20 max-w-md text-[15px] leading-relaxed text-bg/60">
            Great prompts get lost in chat history. Prompt Diary captures them at the
            moment they work, chains them into reusable recipes, and moves whole
            conversations between models — so the work compounds.
          </p>
        </div>
      </section>

      {/* ---------- flagship features: the product, drawn ---------- */}
      <section className="px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="st-reveal text-xs font-semibold uppercase tracking-[0.08em] text-dim">What it does</p>
          <h2 className="st-reveal mt-2 max-w-2xl font-display text-[clamp(30px,4vw,44px)] font-light leading-[1.1] tracking-[-0.01em]">
            Four moves that make prompts compound.
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="st-reveal group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-line bg-raised md:aspect-[4/3]"
              >
                {/* pastel atmosphere INSIDE the card — the floating glass
                    panel above it has something real to frost */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full opacity-70 blur-[70px] ${ORB_WASHES[i % ORB_WASHES.length]}`}
                />
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -bottom-14 -left-10 h-56 w-56 rounded-full opacity-60 blur-[70px] ${ORB_WASHES[(i + 2) % ORB_WASHES.length]}`}
                />
                <span className="absolute left-5 top-4 font-mono text-xs tabular-nums text-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="scale-90 transition-transform duration-300 ease-out group-hover:scale-95 md:scale-100 md:group-hover:scale-105">
                  {f.mock}
                </div>
                {/* hover veil — title rises from below */}
                <div className="absolute inset-0 flex flex-col justify-end bg-ink/85 p-6 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  <h3 className="translate-y-8 font-display text-2xl font-light text-bg transition-transform duration-300 group-hover:translate-y-0">
                    {f.title}
                  </h3>
                  <p className="mt-2 max-w-sm translate-y-8 text-sm leading-relaxed text-bg/70 transition-transform delay-75 duration-300 group-hover:translate-y-0">
                    {f.body}
                  </p>
                </div>
                {/* mobile caption (no hover) */}
                <p className="absolute inset-x-5 bottom-4 text-sm font-medium text-ink md:hidden">{f.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- capabilities: hover list with floating previews ---------- */}
      <section className="border-y border-line bg-raised px-6 py-24 md:px-10 md:py-32">
        <div className="relative mx-auto max-w-6xl">
          <p className="st-reveal text-xs font-semibold uppercase tracking-[0.08em] text-dim">And everything around them</p>
          <ul className="mt-8">
            {CAPABILITIES.map((c, i) => (
              <li
                key={c.title}
                className="st-reveal relative border-t border-line last:border-b"
                onMouseEnter={() => setHoverCap(i)}
                onMouseLeave={() => setHoverCap(null)}
              >
                <div
                  className={`flex items-baseline justify-between gap-6 py-6 transition-opacity duration-300 md:py-8 ${
                    hoverCap !== null && hoverCap !== i ? "opacity-20" : "opacity-100"
                  }`}
                >
                  <h3 className="font-display text-[clamp(26px,4.5vw,56px)] font-light uppercase leading-none tracking-[-0.02em] text-ink">
                    {c.title}
                  </h3>
                  <span className="shrink-0 font-display text-lg italic text-amber">{c.note}</span>
                </div>
                {/* floating preview — glass, materializes rather than fades:
                    scale + blur resolve together (never from scale 0) */}
                <div
                  aria-hidden
                  className={`glass pointer-events-none absolute right-[6%] top-1/2 z-10 hidden w-[22rem] max-w-[26vw] -translate-y-1/2 rounded-xl p-4 transition-[opacity,transform,filter] duration-200 ease-out lg:block ${
                    hoverCap === i
                      ? "rotate-2 scale-100 opacity-100 blur-0"
                      : "rotate-2 scale-[0.97] opacity-0 blur-[3px]"
                  }`}
                >
                  <p className="text-sm leading-relaxed text-body">{c.preview}</p>
                </div>
                {/* mobile: preview inline */}
                <p className="pb-6 text-sm leading-relaxed text-dim lg:hidden">{c.preview}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- manifesto ---------- */}
      <section data-quote className="px-6 py-32 text-center md:py-44">
        <p className="mx-auto max-w-3xl font-display text-[clamp(28px,4.5vw,52px)] font-light leading-[1.2] tracking-[-0.01em] text-ink">
          {quote.map((w, i) => (
            <span key={i} className="quote-word inline-block">
              {w}
              {i < quote.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
        <p className="st-reveal mx-auto mt-6 max-w-md text-sm leading-relaxed text-dim">
          Private by default. Team when you choose. Public when you&apos;re proud of it.
        </p>
      </section>

      {/* ---------- closing band + giant wordmark footer ---------- */}
      <footer className="relative overflow-hidden bg-ink px-6 pt-24 text-bg md:px-10 md:pt-32">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-0 h-[28rem] w-[28rem] rounded-full bg-orb-mint/15 blur-[150px]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
            <div>
              <h2 className="st-reveal font-display text-[clamp(34px,5vw,64px)] font-light uppercase leading-[1.02] tracking-[-0.02em]">
                Start keeping
                <br />
                what works.
              </h2>
              <div className="st-reveal mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-full bg-bg px-6 py-3 text-[15px] font-medium text-ink transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
                >
                  Start your diary — free
                </Link>
                <Link
                  href="/gallery"
                  className="rounded-full border border-bg/40 px-6 py-3 text-[15px] font-medium text-bg transition-[border-color,transform] duration-150 hover:border-bg active:scale-[0.97]"
                >
                  See the gallery
                </Link>
              </div>
            </div>
            <button
              onClick={toTop}
              aria-label="Back to top"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-bg/40 text-bg transition-colors hover:border-bg"
            >
              <ArrowUp size={18} />
            </button>
          </div>

          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-bg/15 pt-6 text-sm text-bg/50">
            <span>© {new Date().getFullYear()} Prompt Diary</span>
            <Link href="/gallery" className="transition-colors hover:text-bg">Gallery</Link>
            <Link href="/privacy" className="transition-colors hover:text-bg">Privacy</Link>
            <Link href="/login" className="transition-colors hover:text-bg">Sign in</Link>
          </div>
        </div>

        {/* the wordmark bleeds off the bottom edge — deliberately */}
        <p
          aria-hidden
          className="pointer-events-none relative -mb-[2vw] mt-10 select-none whitespace-nowrap text-center font-display text-[12.5vw] font-light uppercase leading-[0.8] tracking-[-0.03em] text-bg/90"
        >
          Prompt Diary
        </p>
      </footer>
    </div>
  );
}
