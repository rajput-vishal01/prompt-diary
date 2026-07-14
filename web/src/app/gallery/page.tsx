"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import type { Prompt } from "shared";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";

interface GalleryPrompt {
  id: string;
  title: string;
  body: string;
  tags: string[];
  useCount: number;
  createdAt: string;
  authorName: string;
}

export default function GalleryPage() {
  const { data: session } = useSession();
  const [prompts, setPrompts] = useState<GalleryPrompt[]>([]);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ownedSourceIds, setOwnedSourceIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ prompt: Prompt; authorName: string } | null>(
    null,
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void api<GalleryPrompt[]>(
        `/api/v1/gallery${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      ).then(setPrompts);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // which gallery prompts are already in my diary (by sourceId)
  useEffect(() => {
    if (!session) return;
    void api<{ sourceId: string | null }[]>("/api/v1/prompts")
      .then((mine) =>
        setOwnedSourceIds(
          new Set(mine.map((p) => p.sourceId).filter((s): s is string => !!s)),
        ),
      )
      .catch(() => {});
  }, [session]);

  const copy = (p: GalleryPrompt) => {
    void navigator.clipboard.writeText(p.body);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const openDetail = async (p: GalleryPrompt) => {
    // list payload stays light; outputs are fetched per-prompt on open
    try {
      const full = await api<Prompt>(`/api/v1/prompts/${p.id}`);
      setDetail({ prompt: full, authorName: p.authorName });
    } catch {
      // prompt was just unpublished/deleted — refresh the list
      setPrompts((prev) => prev.filter((x) => x.id !== p.id));
    }
  };

  const addToDiary = async (p: GalleryPrompt) => {
    try {
      await api("/api/v1/prompts", {
        method: "POST",
        body: {
          title: p.title,
          body: p.body,
          tags: p.tags,
          visibility: "private",
          sourceId: p.id,
        },
      });
    } catch {
      // 409 = already there; fall through and mark it owned either way
    }
    setOwnedSourceIds((prev) => new Set(prev).add(p.id));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* logged-in users arrive from the dashboard — keep them in its shell */}
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Public Gallery</h1>
            <p className="text-sm text-dim">
              Open-source prompts shared by the community.
            </p>
          </div>
          {!session && (
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </div>

      <input
        className="input mb-4"
        placeholder="Search public prompts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="space-y-3">
        {prompts.length === 0 && (
          <p className="py-16 text-center text-dim">
            No public prompts{query ? " match your search" : " yet"}.
          </p>
        )}
        {prompts.map((p) => (
          <div
            key={p.id}
            className="card cursor-pointer transition-colors hover:border-accent"
            onClick={() => void openDetail(p)}
            title="Open before/after view"
          >
            <div className="flex items-center gap-2">
              <h2 className="flex-1 truncate font-semibold">{p.title}</h2>
              {copiedId === p.id && (
                <span className="text-xs text-accent">Copied!</span>
              )}
              <button
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  copy(p);
                }}
              >
                Copy
              </button>
              {session &&
                (ownedSourceIds.has(p.id) ? (
                  <span className="text-xs font-semibold text-accent">
                    In your diary
                  </span>
                ) : (
                  <button
                    className="btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void addToDiary(p);
                    }}
                  >
                    + Add to my diary
                  </button>
                ))}
            </div>
            <p className="mt-1 line-clamp-3 font-mono text-xs leading-relaxed text-dim">
              {p.body}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {p.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
              <span className="ml-auto text-xs text-dim">
                by {p.authorName} · used {p.useCount}×
              </span>
            </div>
          </div>
        ))}
      </div>
        </div>
      </div>

      {detail && (
        <GalleryDetail
          prompt={detail.prompt}
          authorName={detail.authorName}
          owned={ownedSourceIds.has(detail.prompt.id)}
          canAdd={!!session}
          onAdd={() => {
            void addToDiary({
              id: detail.prompt.id,
              title: detail.prompt.title,
              body: detail.prompt.body,
              tags: detail.prompt.tags,
              useCount: detail.prompt.useCount,
              createdAt: detail.prompt.createdAt,
              authorName: detail.authorName,
            });
          }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function GalleryDetail({
  prompt,
  authorName,
  owned,
  canAdd,
  onAdd,
  onClose,
}: {
  prompt: Prompt;
  authorName: string;
  owned: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasOutputs =
    prompt.outputBefore || prompt.outputAfter || prompt.imageBefore || prompt.imageAfter;

  const copyPrompt = () => {
    void navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    // read-only twin of the My Prompts detail view
    <div className="fixed inset-0 z-50 flex flex-col bg-bg p-6">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <button className="btn" onClick={onClose}>
            ← Back
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">
            {prompt.title}
          </h2>
          <span className="text-xs text-dim">by {authorName}</span>
          {copied && <span className="text-xs font-bold text-accent">Copied</span>}
          <button className="btn" onClick={copyPrompt}>
            Copy prompt
          </button>
          {canAdd &&
            (owned ? (
              <span className="text-xs font-semibold text-accent">In your diary</span>
            ) : (
              <button className="btn-primary" onClick={onAdd}>
                + Add to my diary
              </button>
            ))}
        </div>

        {hasOutputs ? (
          <div className="grid min-h-0 flex-[1.2] grid-cols-2 gap-4">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-raised">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold text-dim">
                BEFORE — output without this prompt
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {prompt.imageBefore && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prompt.imageBefore} alt="before output" className="w-full border-b border-line object-contain" />
                )}
                <pre className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-dim">
                  {prompt.outputBefore ?? (prompt.imageBefore ? "" : "No sample provided.")}
                </pre>
              </div>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-accent/40 bg-raised">
              <div className="border-b border-line bg-tint px-3 py-2 text-xs font-semibold text-accent">
                AFTER — output with this prompt
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {prompt.imageAfter && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prompt.imageAfter} alt="after output" className="w-full border-b border-line object-contain" />
                )}
                <pre className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-ink">
                  {prompt.outputAfter ?? (prompt.imageAfter ? "" : "No sample provided.")}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-[10px] border border-line bg-raised px-4 py-3 text-sm text-dim">
            The author hasn't added before/after output samples for this prompt.
          </p>
        )}

        <div
          className={`flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-raised ${hasOutputs ? "flex-1" : "flex-[2]"}`}
        >
          <div className="border-b border-line px-3 py-2 text-xs font-semibold text-dim">
            THE PROMPT
          </div>
          <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-ink">
            {prompt.body}
          </pre>
        </div>

        <div className="flex items-center gap-3">
          {prompt.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
          <span className="ml-auto text-xs tabular-nums text-dim">
            used {prompt.useCount}×
          </span>
        </div>
      </div>
    </div>
  );
}
