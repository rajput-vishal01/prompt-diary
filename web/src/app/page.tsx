import Link from "next/link";

const STEPS = [
  {
    title: "Save",
    body: "Highlight a prompt in ChatGPT, Claude, or anywhere — right-click → Save to Prompt Diary. It's in your vault before the reply finishes streaming.",
  },
  {
    title: "Organize",
    body: "Folders, tags, pins, search. Your best prompts stop being lost twenty scrolls deep in chat history.",
  },
  {
    title: "Share — or don't",
    body: "Every prompt is private by default. Flip one to your team's library, or publish it open-source to the public gallery.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between border-b border-line py-5">
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
      </header>

      <section className="py-20">
        <h1 className="max-w-xl font-display text-5xl font-medium leading-tight [text-wrap:balance]">
          Your best prompts, <em className="text-accent">kept</em>.
        </h1>
        <p className="mt-6 max-w-lg leading-relaxed text-dim">
          A password manager, but for prompts. The ones that actually work get
          lost in chat history — Prompt Diary saves them from any page,
          organizes them, syncs them across devices, and shares them on your
          terms.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/login" className="btn-primary px-5 py-2.5">
            Start your diary
          </Link>
          <Link href="/gallery" className="btn px-5 py-2.5">
            Browse public prompts
          </Link>
        </div>
      </section>

      <section className="border-t border-line">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="grid gap-2 border-b border-line py-8 sm:grid-cols-[10rem_1fr]"
          >
            <h2 className="font-display text-xl italic text-accent">
              {i + 1}. {s.title}
            </h2>
            <p className="max-w-prose leading-relaxed text-dim">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="py-14">
        <div className="rounded-[10px] border border-line bg-raised p-6 font-mono text-sm leading-relaxed text-dim">
          <p className="text-ink">
            You are a senior code reviewer. For each diff, list…
          </p>
          <p className="mt-3 flex items-center gap-3 text-xs">
            <span className="vis-badge text-accent">public</span>
            <span className="chip">code-review</span>
            <span className="ml-auto">used 214×</span>
          </p>
        </div>
        <p className="mt-3 text-center text-xs text-dim">
          A prompt, as it lives in the ledger.
        </p>
      </section>

      <footer className="mt-auto border-t border-line py-6 text-center text-xs text-dim">
        Prompt Diary — local-first, open at heart. Your private prompts never
        leave your vault.
      </footer>
    </main>
  );
}
