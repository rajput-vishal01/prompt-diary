"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Copy, Link2 } from "lucide-react";
import type { Prompt } from "shared";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { ZoomableImage } from "@/components/ZoomableImage";
import { Tip } from "@/components/ui/Tooltip";

type GalleryDetail = Prompt & { authorName: string };

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState<GalleryDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    void api<GalleryDetail>(`/api/v1/prompts/${id}`)
      .then(setPrompt)
      .catch(() => {
        toast("Prompt not found", { kind: "error" });
        router.push("/gallery");
      });
  }, [id, router]);

  useEffect(() => {
    if (!session) return;
    void api<string[]>("/api/v1/gallery/bookmarks")
      .then((ids) => setBookmarked(ids.includes(id)))
      .catch(() => {});
    void api<{ sourceId: string | null }[]>("/api/v1/prompts")
      .then((mine) => setOwned(mine.some((p) => p.sourceId === id)))
      .catch(() => {});
  }, [session, id]);

  if (!prompt) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Suspense>
          <Sidebar />
        </Suspense>
        <div className="mx-auto w-full max-w-4xl p-8">
          <div className="skeleton h-8 w-1/2" />
          <div className="skeleton mt-4 h-64 w-full" />
        </div>
      </div>
    );
  }

  const hasOutputs =
    prompt.outputBefore || prompt.outputAfter || prompt.imageBefore || prompt.imageAfter;

  const copyPrompt = () => {
    void navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    // count the copy — this powers the "most copied" sort
    void api("/api/v1/gallery/copied", { method: "POST", body: { promptId: prompt.id } }).catch(() => {});
  };

  const toggleBookmark = async () => {
    if (!session) {
      toast("Sign in to bookmark prompts", { kind: "error" });
      return;
    }
    setBookmarked((v) => !v);
    try {
      if (bookmarked) {
        await api(`/api/v1/gallery/bookmarks?promptId=${id}`, { method: "DELETE" });
      } else {
        await api("/api/v1/gallery/bookmarks", { method: "POST", body: { promptId: id } });
      }
    } catch {
      setBookmarked(bookmarked);
      toast("Bookmark failed", { kind: "error" });
    }
  };

  const addToDiary = async () => {
    try {
      await api("/api/v1/prompts", {
        method: "POST",
        body: {
          title: prompt.title,
          body: prompt.body,
          tags: prompt.tags,
          visibility: "private",
          sourceId: prompt.id,
        },
      });
      toast("Added to your diary");
    } catch (e) {
      // only 409 "Already in your diary" means it's genuinely owned; any other
      // failure must not silently flip the UI to "In your diary"
      const already = e instanceof Error && e.message.includes("Already in your diary");
      if (!already) {
        toast(e instanceof Error ? e.message : "Could not add to your diary", { kind: "error" });
        return;
      }
    }
    setOwned(true);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 p-8">
          {/* top bar — ghost back, quiet actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-body transition-colors hover:bg-hover hover:text-ink"
              onClick={() => router.push("/gallery")}
            >
              <ArrowLeft size={15} /> Gallery
            </button>
            <span className="flex-1" />
            <button className="btn" onClick={copyPrompt}>
              <Copy size={13} className={copied ? "text-success" : ""} />
              {copied ? "Copied" : "Copy prompt"}
            </button>
            <Tip label={bookmarked ? "Remove bookmark" : "Bookmark for later"}>
            <button
              className="btn"
              onClick={() => void toggleBookmark()}
            >
              <Bookmark size={13} className={bookmarked ? "fill-brass text-brass" : ""} />
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </button>
            </Tip>
            <Tip label="Copy a public share link">
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(`${location.origin}/p/${prompt.id}`);
                toast("Share link copied");
              }}
            >
              <Link2 size={13} /> Share
            </button>
            </Tip>
            {session &&
              (owned ? (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-success">
                  In your diary
                </span>
              ) : (
                <button className="btn-primary" onClick={() => void addToDiary()}>
                  + Add to my diary
                </button>
              ))}
          </div>

          {/* masthead */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dim">
              Gallery prompt · by {prompt.authorName}
              {prompt.useCount > 0 && <span className="tabular-nums"> · used {prompt.useCount}×</span>}
            </p>
            <h1 className="mt-1 font-display text-3xl font-light tracking-[-0.01em] text-ink">
              {prompt.title}
            </h1>
            {prompt.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {prompt.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* before/after — the proof panes */}
          {hasOutputs && (
            <div className="grid gap-4 sm:grid-cols-2">
              <section>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                  Before — without this prompt
                </p>
                <div className="rounded-xl border border-line bg-raised p-4">
                  {prompt.imageBefore && (
                    <ZoomableImage src={prompt.imageBefore} alt="before output" wrapClassName="mb-3" imgClassName="max-h-56 w-full rounded-lg object-contain" />
                  )}
                  <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-dim">
                    {prompt.outputBefore ?? (prompt.imageBefore ? "" : "No sample provided.")}
                  </p>
                </div>
              </section>
              <section>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                  After — with this prompt
                </p>
                <div className="rounded-xl border border-line-strong bg-raised p-4">
                  {prompt.imageAfter && (
                    <ZoomableImage src={prompt.imageAfter} alt="after output" wrapClassName="mb-3" imgClassName="max-h-56 w-full rounded-lg object-contain" />
                  )}
                  <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink">
                    {prompt.outputAfter ?? (prompt.imageAfter ? "" : "No sample provided.")}
                  </p>
                </div>
              </section>
            </div>
          )}

          {/* the manuscript */}
          <div className="flex min-h-0 flex-1 flex-col">
            <span className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
              The prompt
            </span>
            <pre className="min-h-40 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl bg-soft p-5 font-mono text-sm leading-relaxed tracking-tight text-ink">
              {prompt.body}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
