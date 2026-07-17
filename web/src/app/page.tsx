"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import {
  SiClaude,
  SiDeepseek,
  SiGithubcopilot,
  SiGooglegemini,
  SiMeta,
  SiMistralai,
  SiPerplexity,
  SiPoe,
  SiQwen,
  SiX,
} from "react-icons/si";
import { GlassSurface, GradualBlur, LogoLoop, SpecularButton, Strands } from "@/components/bits";
import { PageVeil } from "@/components/PageVeil";
import { CapVisual, PopupMock, SavedChipMock, ThreadMock, TransferMock, WidgetMock } from "@/components/landing/mocks";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// ---------------------------------------------------------------- data

const MENU_LINKS = [
  { label: "Home", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: "Sign in", href: "/login" },
  { label: "Start free", href: "/login" },
  { label: "Privacy", href: "/privacy" },
];

// hero strand ribbons — saturated cousins of the orb pastels so the WebGL
// layer actually reads on the light canvas
const STRAND_COLORS = ["#34d399", "#fb923c", "#a78bfa", "#38bdf8"];

// every model we ride along with, as icon+name lockups for the logo loop.
// ChatGPT/Kimi have no simple-icons mark (trademark takedowns); Grok wears X.
const siteLogo = (label: string, icon?: React.ReactNode) => ({
  node: (
    <span className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.14em] text-dim">
      {icon}
      {label}
    </span>
  ),
  title: label,
});

const AI_LOGOS = [
  siteLogo("ChatGPT"),
  siteLogo("Claude", <SiClaude size={15} />),
  siteLogo("Gemini", <SiGooglegemini size={15} />),
  siteLogo("Perplexity", <SiPerplexity size={15} />),
  siteLogo("Poe", <SiPoe size={15} />),
  siteLogo("DeepSeek", <SiDeepseek size={15} />),
  siteLogo("Grok", <SiX size={13} />),
  siteLogo("Copilot", <SiGithubcopilot size={15} />),
  siteLogo("Le Chat", <SiMistralai size={15} />),
  siteLogo("Kimi"),
  siteLogo("Qwen", <SiQwen size={15} />),
  siteLogo("Meta AI", <SiMeta size={15} />),
];

const FEATURES = [
  {
    title: "Save from anywhere",
    body: "Select text on any AI site and it's in your vault before the reply finishes streaming. Launcher popup, Alt+P, one keystroke to paste it back.",
    mock: <PopupMock />,
    wash: "bg-orb-mint",
  },
  {
    title: "Threads are recipes",
    body: "Not transcripts — the ordered chain of prompts that produced one great result. Record as you work, replay any time, shelve them into projects.",
    mock: <ThreadMock />,
    wash: "bg-orb-peach",
  },
  {
    title: "Carry the context",
    body: "Deep in a chat but want a different model? Capture the conversation and continue it on another AI, exactly where you left off.",
    mock: <TransferMock />,
    wash: "bg-orb-lavender",
  },
  {
    title: "Know your limits",
    body: "A quiet on-page meter estimates your sends against each model's caps — thinking modes tracked separately, because one Max message isn't one message.",
    mock: <WidgetMock />,
    wash: "bg-orb-sky",
  },
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

// menu overlay: dark glass expands from the burger like a droplet
const menuClip = {
  closed: { clipPath: "circle(20px at calc(100% - 56px) 44px)" },
  open: { clipPath: "circle(150% at calc(100% - 56px) 44px)" },
};

const menuList = {
  open: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } },
  closed: {},
};

const menuItem = {
  open: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  closed: { y: 48, opacity: 0 },
};

// the nav's contents render identically inside the glass pill and over the
// dark menu overlay — only the surrounding surface changes
function HeaderNav({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  return (
    <>
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
          onClick={onToggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- page

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverCap, setHoverCap] = useState<number | null>(null);
  const [activeFeature, setActiveFeature] = useState(0);
  // WebGL layers (strands, specular CTAs) mount only when motion is welcome
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Lenis smooth scroll — 1.2s exponential ease-out
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

  // menu overlay stops the page under it
  useEffect(() => {
    const lenis = lenisRef.current;
    if (menuOpen) {
      lenis?.stop();
      document.body.style.overflow = "hidden";
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
      // the manifesto line reveals word by word
      gsap.from(".quote-word", {
        opacity: 0.12,
        stagger: 0.06,
        duration: 0.4,
        ease: "none",
        scrollTrigger: { trigger: "[data-quote]", start: "top 80%", end: "top 40%", scrub: true },
      });
      // sticky stack: each section pins; the previous card sinks back and dims
      // as the next slides over it (sticky does the pinning, gsap the depth)
      const cards = gsap.utils.toArray<HTMLElement>(".stack-card");
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.93,
          opacity: 0.4,
          ease: "none",
          scrollTrigger: { trigger: next, start: "top bottom", end: "top top", scrub: true },
        });
      });
    },
    { scope: root },
  );

  const toTop = () => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.5 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const quote = "The prompt that finally worked is an asset. Treat it like one.".split(" ");
  const stackCard = `stack-card relative overflow-hidden rounded-t-[2.5rem] border-t border-line ${
    reducedMotion ? "" : "sticky top-0"
  }`;
  // dwell runway: an empty spacer AFTER each pinned card — the card is stuck
  // at top-0 while the spacer scrolls by, so it holds still (~reading time)
  // before the next sibling slides over. Never wrap the cards instead: a
  // wrapper cages the sticky inside itself and kills the pile-up.
  const dwell = reducedMotion ? "hidden" : "h-[45dvh]";
  const dwellLast = reducedMotion ? "hidden" : "h-[20dvh]";
  const active = FEATURES[activeFeature] ?? FEATURES[0]!;

  return (
    <div ref={root} className="min-h-screen overflow-x-clip bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* ---------- header: a permanent refractive glass pill ----------
          GlassSurface bends the page through its edge (SVG displacement in
          Chromium, Ink Glass frost elsewhere). Fixed, never hides. */}
      <header id="pd-header" className="fixed inset-x-0 top-0 z-50 px-4 md:px-6">
        <div className="mx-auto mt-3 max-w-6xl">
          {menuOpen ? (
            <div className="flex h-14 items-center justify-between px-6 text-bg">
              <HeaderNav menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((o) => !o)} />
            </div>
          ) : (
            <GlassSurface
              width="100%"
              height={56}
              borderRadius={28}
              backgroundOpacity={0.12}
              saturation={1.5}
              distortionScale={-130}
              displace={0.4}
            >
              <div className="flex w-full items-center justify-between px-4 text-ink">
                <HeaderNav menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((o) => !o)} />
              </div>
            </GlassSurface>
          )}
        </div>
      </header>

      {/* ---------- menu: dark glass droplet expanding from the burger ---------- */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="glass-ink fixed inset-0 z-40 flex flex-col justify-center rounded-none border-0 px-8 md:px-16"
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuClip}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.nav className="flex flex-col gap-1" variants={menuList}>
              {MENU_LINKS.map((l, i) => (
                <motion.div key={l.label} variants={menuItem}>
                  <Link
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="group flex items-baseline gap-4 py-1"
                  >
                    <span className="font-mono text-xs tabular-nums text-bg/40">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-[11vw] font-light uppercase leading-[1.02] tracking-[-0.02em] text-bg transition-opacity group-hover:opacity-60 md:text-[5.5vw]">
                      {l.label}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </motion.nav>
            <motion.p variants={menuItem} className="mt-10 max-w-sm text-sm leading-relaxed text-bg/50">
              A password manager for prompts. Save, organize, sync, and share — on your terms.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- hero: copy left, floating product glass right ---------- */}
      <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-6 pt-28 md:px-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <span className="pd-glow-word select-none bg-gradient-to-br from-orb-mint via-orb-peach to-orb-lavender bg-clip-text font-display text-[42vw] font-light italic leading-none text-transparent">
            Pd
          </span>
          {!reducedMotion && (
            <div className="absolute inset-0">
              <Strands
                colors={STRAND_COLORS}
                count={5}
                speed={0.35}
                amplitude={1.2}
                waviness={0.95}
                thickness={0.8}
                glow={2.6}
                taper={2.2}
                spread={1.15}
                intensity={0.7}
                saturation={1.25}
                opacity={0.95}
                scale={1.2}
              />
            </div>
          )}
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h1 className="font-display font-medium uppercase leading-[0.96] tracking-[-0.02em]">
              {["Your best", "prompts,", "kept."].map((line) => (
                <span key={line} className="block overflow-hidden">
                  <span className="hero-line block text-[clamp(48px,8.5vw,92px)]">{line}</span>
                </span>
              ))}
            </h1>

            <div data-hero-sub className="mt-8 max-w-xl">
              <p className="text-[17px] leading-relaxed text-body">
                The prompt that finally worked is twenty scrolls deep in last week&apos;s
                chat. Save it from any AI site, organize it, reuse it in one keystroke,
                and carry whole conversations between models.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {reducedMotion ? (
                  <Link href="/login" className="btn-primary px-6 py-3 text-[15px]">
                    Start your diary
                  </Link>
                ) : (
                  <SpecularButton
                    size="md"
                    radius={999}
                    tint="#0c0a09"
                    tintOpacity={0.92}
                    textColor="#fafafa"
                    lineColor="#ffffff"
                    baseColor="#57534e"
                    intensity={1}
                    shineSize={12}
                    shineFade={42}
                    thickness={1}
                    followMouse
                    proximity={240}
                    className="pd-cta"
                    onClick={() => router.push("/login")}
                  >
                    Start your diary
                  </SpecularButton>
                )}
                <Link href="/gallery" className="btn px-6 py-3 text-[15px]">
                  Browse the gallery
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-dim">
                Free · works offline · your private prompts never leave your vault
              </p>
            </div>
          </div>

          {/* the product floats: tilted glass panels drifting over the strands */}
          <div aria-hidden className="relative hidden h-[440px] lg:block">
            <motion.div
              className="absolute left-0 top-2 -rotate-[5deg]"
              animate={reducedMotion ? undefined : { y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="scale-110">
                <PopupMock />
              </div>
            </motion.div>
            <motion.div
              className="absolute right-2 top-52 rotate-[4deg]"
              animate={reducedMotion ? undefined : { y: [0, 10, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            >
              <WidgetMock />
            </motion.div>
            <motion.div
              className="absolute bottom-6 left-16 rotate-[2deg]"
              animate={reducedMotion ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
            >
              <SavedChipMock />
            </motion.div>
          </div>
        </div>

        {/* the atmosphere dissolves progressively where the hero hands off */}
        <GradualBlur
          target="parent"
          position="bottom"
          height="5rem"
          strength={1.6}
          divCount={5}
          curve="bezier"
          exponential
          opacity={1}
          zIndex={20}
        />
      </section>

      {/* ---------- logo loop ---------- */}
      <section className="border-y border-line py-5" aria-label="Supported AI sites">
        <LogoLoop
          logos={AI_LOGOS}
          speed={55}
          logoHeight={18}
          gap={56}
          hoverSpeed={14}
          fadeOut
          fadeOutColor="#f5f5f5"
          ariaLabel="Supported AI sites"
        />
      </section>

      {/* ================= the stacked story: sections pin and pile up,
          each new card sliding over the last while it sinks back ============ */}

      {/* ---------- card 1: the idea, spelled large ---------- */}
      <section className={`${stackCard} bg-ink text-bg`}>
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-orb-lavender/20 blur-[150px]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-orb-peach/20 blur-[150px]" />

        <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-24 md:px-10">
          <div className="st-reveal relative">
            <span aria-hidden className="absolute -top-10 left-2 -rotate-6 font-display text-2xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.6))]">
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
            <span aria-hidden className="absolute -right-4 -top-8 -rotate-12 font-display text-xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.6))] md:right-[18%]">
              recipes, not transcripts
            </span>
          </div>

          <div className="st-reveal relative mt-6 md:ml-[6%]">
            <p className="font-display text-[clamp(40px,7vw,88px)] font-light uppercase leading-[1.02] tracking-[-0.02em]">
              Carry the context.
            </p>
            <span aria-hidden className="absolute -bottom-9 left-6 -rotate-3 font-display text-xl italic text-amber [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.6))]">
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
      <div aria-hidden className={dwell} />

      {/* ---------- card 2: what it does — the feature stage ---------- */}
      <section className={`${stackCard} bg-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`}>
        <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-24 md:px-10">
          <p className="st-reveal text-xs font-semibold uppercase tracking-[0.08em] text-dim">What it does</p>
          <h2 className="st-reveal mt-2 max-w-2xl font-display text-[clamp(30px,4vw,44px)] font-light leading-[1.1] tracking-[-0.01em]">
            Four moves that make prompts compound.
          </h2>

          {/* desktop: numbered titles drive the glass stage on the right */}
          <div className="mt-12 hidden items-center gap-16 lg:grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col gap-2">
              {FEATURES.map((f, i) => (
                <button
                  key={f.title}
                  className="group flex items-baseline gap-4 py-2 text-left"
                  onMouseEnter={() => setActiveFeature(i)}
                  onFocus={() => setActiveFeature(i)}
                  onClick={() => setActiveFeature(i)}
                >
                  <span className={`font-mono text-xs tabular-nums transition-colors duration-200 ${activeFeature === i ? "text-amber" : "text-dim"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`font-display text-[clamp(24px,2.6vw,38px)] font-light leading-tight tracking-[-0.01em] transition-[opacity,transform] duration-300 ${
                      activeFeature === i ? "opacity-100" : "opacity-30 group-hover:opacity-60"
                    }`}
                  >
                    {f.title}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-line bg-raised shadow-soft">
              <div aria-hidden className={`pointer-events-none absolute -right-14 -top-14 h-72 w-72 rounded-full opacity-70 blur-[80px] transition-colors duration-500 ${active.wash}`} />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-60 w-60 rounded-full bg-orb-sky opacity-50 blur-[80px]" />
              <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-8 p-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature}
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(6px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="flex flex-col items-center gap-8"
                  >
                    <div className="scale-110">{active.mock}</div>
                    <p className="max-w-sm text-center text-sm leading-relaxed text-body">{active.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* mobile: simple stacked cards */}
          <div className="mt-10 flex flex-col gap-6 lg:hidden">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="st-reveal relative overflow-hidden rounded-2xl border border-line bg-raised p-6">
                <div aria-hidden className={`pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-60 blur-[60px] ${f.wash}`} />
                <span className="font-mono text-xs tabular-nums text-amber">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-1 font-display text-2xl font-light">{f.title}</h3>
                <div className="relative my-5 flex justify-center">{f.mock}</div>
                <p className="text-sm leading-relaxed text-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div aria-hidden className={dwell} />

      {/* ---------- card 3: capabilities — hover list with popping previews ---------- */}
      <section className={`${stackCard} border-line bg-raised`}>
        <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-24 md:px-10">
          <p className="st-reveal text-xs font-semibold uppercase tracking-[0.08em] text-dim">And everything around them</p>
          <ul className="mt-8">
            {CAPABILITIES.map((c, i) => (
              <li
                key={c.title}
                className="st-reveal relative border-t border-line last:border-b"
                onMouseEnter={() => setHoverCap(i)}
                onMouseLeave={() => setHoverCap(null)}
              >
                <motion.div
                  className={`flex items-baseline justify-between gap-6 py-5 transition-opacity duration-300 md:py-7 ${
                    hoverCap !== null && hoverCap !== i ? "opacity-20" : "opacity-100"
                  }`}
                  animate={{ scale: hoverCap === i ? 1.02 : 1, x: hoverCap === i ? 8 : 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  style={{ transformOrigin: "left center" }}
                >
                  <h3 className="font-display text-[clamp(26px,4.5vw,54px)] font-light uppercase leading-none tracking-[-0.02em] text-ink">
                    {c.title}
                  </h3>
                  <span className="shrink-0 font-display text-lg italic text-amber">{c.note}</span>
                </motion.div>
                {/* floating preview — glass card with a drawn visual, springs in */}
                <AnimatePresence>
                  {hoverCap === i && (
                    <motion.div
                      aria-hidden
                      className="glass pointer-events-none absolute right-[6%] top-1/2 z-10 hidden w-[23rem] max-w-[27vw] rounded-xl p-4 lg:block"
                      initial={{ opacity: 0, scale: 0.92, rotate: 4, y: "-42%" }}
                      animate={{ opacity: 1, scale: 1, rotate: 2, y: "-50%" }}
                      exit={{ opacity: 0, scale: 0.95, rotate: 3, y: "-46%" }}
                      transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    >
                      <CapVisual index={i} />
                      <p className="text-sm leading-relaxed text-body">{c.preview}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* mobile: preview inline */}
                <p className="pb-6 text-sm leading-relaxed text-dim lg:hidden">{c.preview}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div aria-hidden className={dwell} />

      {/* ---------- card 4: manifesto ---------- */}
      <section data-quote className={`${stackCard} bg-bg text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`}>
        <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center px-6 py-24">
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
        </div>
      </section>
      <div aria-hidden className={dwellLast} />

      {/* ---------- closing band + wordmark footer (fits any viewport) ---------- */}
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
              <div className="st-reveal mt-8 flex flex-wrap items-center gap-3">
                {reducedMotion ? (
                  <Link
                    href="/login"
                    className="rounded-full bg-bg px-6 py-3 text-[15px] font-medium text-ink transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
                  >
                    Start your diary — free
                  </Link>
                ) : (
                  <SpecularButton
                    size="md"
                    radius={999}
                    tint="#f5f5f5"
                    tintOpacity={0.96}
                    textColor="#0c0a09"
                    lineColor="#ffffff"
                    baseColor="#a8a29e"
                    intensity={1}
                    shineSize={14}
                    shineFade={46}
                    thickness={1}
                    followMouse
                    proximity={260}
                    className="pd-cta"
                    onClick={() => router.push("/login")}
                  >
                    Start your diary — free
                  </SpecularButton>
                )}
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

        {/* wordmark bleeds off the bottom edge; textLength pins it to the
            viewport width so it can never overflow horizontally */}
        <svg aria-hidden viewBox="0 0 1200 200" className="relative -mb-[1.5vw] mt-10 block w-full select-none">
          <text
            x="600"
            y="165"
            textAnchor="middle"
            textLength="1180"
            lengthAdjust="spacingAndGlyphs"
            className="fill-bg/90 font-display"
            style={{ fontSize: 168, letterSpacing: "-0.02em" }}
          >
            PROMPT DIARY
          </text>
        </svg>
      </footer>

      {/* content dissolves at the viewport's bottom edge, everywhere but the dashboard */}
      <PageVeil />
    </div>
  );
}
