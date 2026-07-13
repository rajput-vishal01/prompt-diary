import Link from "next/link";

export const metadata = { title: "Privacy — Prompt Diary" };

const SECTIONS = [
  {
    h: "What we store",
    p: "Prompts, folders, and tags you save; your account email and display name. Prompts marked private are visible only to you. Team prompts are visible to members of that team. Public prompts are visible to anyone.",
  },
  {
    h: "Where it lives",
    p: "The Chrome extension keeps a full copy of your vault on your device (chrome.storage.local) and works offline. If you sign in, your vault syncs to our database so it's available across devices and on the dashboard.",
  },
  {
    h: "What we don't do",
    p: "We don't sell your data, we don't read your private prompts, we don't track you across the web, and the extension never touches page content except the text you explicitly select and save.",
  },
  {
    h: "Emails",
    p: "We send exactly one kind of email: account verification. No newsletters, no marketing.",
  },
  {
    h: "Deleting your data",
    p: "Delete prompts any time from the dashboard or extension. Removing the extension deletes the local vault. To delete your account and all synced data, contact us and we'll remove it.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6">
      <header className="border-b border-line py-5">
        <Link href="/" className="font-display text-xl italic">
          Prompt <span className="text-accent">Diary</span>
        </Link>
      </header>
      <h1 className="pt-12 font-display text-4xl font-medium">Privacy</h1>
      <p className="mt-3 text-sm text-dim">
        The short version: your prompts are yours. Everything is private by
        default and only shared when you flip a prompt to team or public.
      </p>
      <div className="mt-8">
        {SECTIONS.map((s) => (
          <section key={s.h} className="border-t border-line py-6">
            <h2 className="font-display text-xl italic text-accent">{s.h}</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-dim">
              {s.p}
            </p>
          </section>
        ))}
      </div>
      <footer className="border-t border-line py-6 text-xs text-dim">
        Questions? Reach the maintainer via the GitHub repository.
      </footer>
    </main>
  );
}
