import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { db } from "@/db";
import { user } from "@/db/schema";
import { loadThreadForViewer } from "@/lib/threads";
import { CopyButton } from "@/components/CopyButton";
import { ZoomableImage } from "@/components/ZoomableImage";
import { PageVeil } from "@/components/PageVeil";
import { ShareCta, ShareHeaderBand } from "@/components/ShareChrome";

type Params = { params: Promise<{ id: string }> };

// public recipe page — anonymous view only, same rule as /p/[id]
async function loadPublicThread(id: string) {
  const t = await loadThreadForViewer(id, null);
  if (!t) return null;
  const author = await db.query.user.findFirst({
    where: eq(user.id, t.userId),
    columns: { name: true },
  });
  return { ...t, authorName: author?.name ?? "Someone" };
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const t = await loadPublicThread(id);
  if (!t) return { title: "Recipe — Prompt Diary", robots: { index: false } };
  const description = `A ${t.steps.length}-step prompt recipe by ${t.authorName} — the ordered chain of prompts that produced one great result.`;
  return {
    title: `${t.title} — Prompt Diary recipe`,
    description,
    alternates: { canonical: `/r/${t.id}` },
    openGraph: {
      title: t.title,
      description,
      url: `/r/${t.id}`,
      type: "article",
    },
    twitter: { card: "summary", title: t.title, description },
  };
}

export default async function PublicThreadPage({ params }: Params) {
  const { id } = await params;
  const t = await loadPublicThread(id);
  if (!t) notFound();

  const copyable = t.steps
    .filter((s) => !s.redacted && "body" in s.prompt)
    .map((s, i) => `# Step ${i + 1}: ${s.prompt.title}\n${(s.prompt as { body: string }).body}`)
    .join("\n\n");

  return (
    <main className="relative mx-auto max-w-2xl px-6 pb-16">
      <PageVeil />
      <ShareHeaderBand />
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
          Shared recipe · by {t.authorName} · {t.steps.length}{" "}
          {t.steps.length === 1 ? "step" : "steps"}
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="font-display text-[34px] font-light leading-[1.15] tracking-[-0.01em] text-ink md:text-4xl">
            {t.title}
          </h1>
          {copyable && <CopyButton text={copyable} label="Copy recipe" />}
        </div>
        <p className="mt-2 max-w-prose text-sm text-dim">
          A recipe is the ordered chain of prompts that produced one great
          result — run the steps in order to reproduce it.
        </p>
      </div>

      {/* numbered manuscript steps */}
      <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-raised">
        {t.steps.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-dim">
            This recipe has no steps yet.
          </p>
        )}
        {t.steps.map((s, i) => (
          <div key={s.prompt.id} className="flex gap-4 px-4 py-4">
            <span className="w-7 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-dim">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-medium text-ink">
                  {s.prompt.title}
                </span>
                {s.redacted && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[10.5px] font-medium text-dim">
                    <Lock size={10} /> private step
                  </span>
                )}
              </div>
              {!s.redacted && "body" in s.prompt && (
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-soft p-3 font-mono text-xs leading-relaxed tracking-tight text-body">
                  {(s.prompt as { body: string }).body}
                </pre>
              )}
              {s.redacted && (
                <p className="mt-1 text-xs text-dim">
                  The author kept this step&apos;s prompt private.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* the deliverable */}
      {(t.finalOutput || t.finalImage) && (
        <div className="mt-8">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            Final output — what this recipe produced
          </p>
          <div className="overflow-hidden rounded-xl bg-soft">
            {t.finalImage && (
              <ZoomableImage
                src={t.finalImage}
                alt="final output"
                imgClassName="max-h-72 w-full border-b border-line object-contain"
              />
            )}
            {t.finalOutput && (
              <pre className="whitespace-pre-wrap p-5 font-mono text-sm leading-relaxed tracking-tight text-ink">
                {t.finalOutput}
              </pre>
            )}
          </div>
        </div>
      )}

      <footer className="mt-12 flex items-center justify-between border-t border-line pt-6">
        <p className="text-xs text-dim">
          Prompt Diary — save the prompts, keep the recipe.
        </p>
        <ShareCta label="Start your diary" />
      </footer>
    </main>
  );
}
