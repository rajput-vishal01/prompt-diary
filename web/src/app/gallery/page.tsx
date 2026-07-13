"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <div className="flex min-h-screen">
      {/* logged-in users arrive from the dashboard — keep them in its shell */}
      <Sidebar />
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
          <div key={p.id} className="card">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 truncate font-semibold">{p.title}</h2>
              {copiedId === p.id && (
                <span className="text-xs text-accent">Copied!</span>
              )}
              <button className="btn" onClick={() => copy(p)}>
                Copy
              </button>
              {session &&
                (ownedSourceIds.has(p.id) ? (
                  <span className="text-xs font-semibold text-accent">
                    In your diary
                  </span>
                ) : (
                  <button className="btn" onClick={() => void addToDiary(p)}>
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
  );
}
