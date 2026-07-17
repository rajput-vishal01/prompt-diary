import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, user } from "@/db/schema";
import { canAccessPrompt } from "@/lib/permissions";
import { CopyButton } from "@/components/CopyButton";
import { PageVeil } from "@/components/PageVeil";

type Params = { params: Promise<{ id: string }> };

// public share page — always renders the ANONYMOUS view, so what the owner
// sees here is exactly what the whole internet sees
async function loadPublicPrompt(id: string) {
  const row = await db.query.prompts.findFirst({ where: eq(prompts.id, id) });
  if (!row || row.deleted) return null;
  if (!(await canAccessPrompt(null, row, "read"))) return null;
  const author = await db.query.user.findFirst({
    where: eq(user.id, row.userId),
    columns: { name: true },
  });
  return { ...row, authorName: author?.name ?? "Someone" };
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const p = await loadPublicPrompt(id);
  return { title: p ? `${p.title} — Prompt Diary` : "Prompt — Prompt Diary" };
}

export default async function PublicPromptPage({ params }: Params) {
  const { id } = await params;
  const p = await loadPublicPrompt(id);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 pb-16">
      <PageVeil />
      <header className="flex items-center justify-between border-b border-line py-5">
        <Link href="/" className="font-display text-xl font-light tracking-tight">
          Prompt <span className="text-accent">Diary</span>
        </Link>
        <Link
          href="/gallery"
          className="text-xs font-medium text-dim transition-colors hover:text-ink"
        >
          Browse the gallery →
        </Link>
      </header>

      <div className="pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dim">
          Shared prompt · by {p.authorName}
        </p>
        <h1 className="mt-2 font-display text-3xl font-light tracking-[-0.01em] text-ink">
          {p.title}
        </h1>
        {p.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-medium text-body"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* the manuscript — same treatment as the dashboard detail view */}
      <div className="mt-6">
        <div className="mb-1.5 flex items-center">
          <span className="flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            The prompt
          </span>
          <CopyButton text={p.body} label="Copy prompt" countPromptId={p.id} />
        </div>
        <pre className="whitespace-pre-wrap rounded-xl bg-soft p-5 font-mono text-sm leading-relaxed tracking-tight text-ink">
          {p.body}
        </pre>
      </div>

      {(p.outputBefore || p.outputAfter || p.imageBefore || p.imageAfter) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(p.outputBefore || p.imageBefore) && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                Before
              </p>
              <div className="rounded-xl border border-line bg-raised p-4">
                {p.imageBefore && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageBefore}
                    alt="output before"
                    className="mb-3 max-h-56 w-full rounded-lg object-contain"
                  />
                )}
                {p.outputBefore && (
                  <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-dim">
                    {p.outputBefore}
                  </p>
                )}
              </div>
            </section>
          )}
          {(p.outputAfter || p.imageAfter) && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                After
              </p>
              <div className="rounded-xl border border-line bg-raised p-4">
                {p.imageAfter && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageAfter}
                    alt="output after"
                    className="mb-3 max-h-56 w-full rounded-lg object-contain"
                  />
                )}
                {p.outputAfter && (
                  <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-dim">
                    {p.outputAfter}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <footer className="mt-12 flex items-center justify-between border-t border-line pt-6">
        <p className="text-xs text-dim">
          Prompt Diary — a vault for your best AI prompts.
        </p>
        <Link
          href="/"
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink"
        >
          Start your diary
        </Link>
      </footer>
    </main>
  );
}
