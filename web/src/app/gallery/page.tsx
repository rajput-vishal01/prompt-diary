"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Copy } from "lucide-react";
import type { Facet } from "shared";
import { FACETS, promptFacets } from "shared";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";

interface GalleryPrompt {
  id: string;
  title: string;
  body: string;
  tags: string[];
  useCount: number;
  createdAt: string;
  authorName: string;
  bookmarked: boolean;
}

interface GalleryRecipe {
  id: string;
  title: string;
  finalOutput: string | null;
  updatedAt: string;
  authorName: string;
  stepCount: number;
}

type Sort = "copied" | "new";

export default function GalleryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [prompts, setPrompts] = useState<GalleryPrompt[]>([]);
  const [recipes, setRecipes] = useState<GalleryRecipe[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("copied");
  const [facetSel, setFacetSel] = useState<Facet[]>([]);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ownedSourceIds, setOwnedSourceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (showRecipes) {
        params.set("type", "threads");
        void api<GalleryRecipe[]>(`/api/v1/gallery?${params}`)
          .then(setRecipes)
          .finally(() => setLoading(false));
      } else {
        params.set("sort", sort);
        if (bookmarkedOnly) params.set("bookmarked", "1");
        void api<GalleryPrompt[]>(`/api/v1/gallery?${params}`)
          .then(setPrompts)
          .finally(() => setLoading(false));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, sort, bookmarkedOnly, showRecipes]);

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

  // computed style facets — heuristics over the text, never stored
  const facetsById = useMemo(
    () => new Map(prompts.map((p) => [p.id, promptFacets(p.body)])),
    [prompts],
  );
  const visible = facetSel.length
    ? prompts.filter((p) => facetSel.every((f) => facetsById.get(p.id)?.includes(f)))
    : prompts;
  const toggleFacet = (f: Facet) =>
    setFacetSel((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );

  const copy = (p: GalleryPrompt) => {
    void navigator.clipboard.writeText(p.body);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const toggleBookmark = async (p: GalleryPrompt) => {
    if (!session) {
      toast("Sign in to bookmark prompts", { kind: "error" });
      return;
    }
    // optimistic — the icon must not lag the click
    setPrompts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, bookmarked: !p.bookmarked } : x)),
    );
    try {
      if (p.bookmarked) {
        await api(`/api/v1/gallery/bookmarks?promptId=${p.id}`, { method: "DELETE" });
      } else {
        await api("/api/v1/gallery/bookmarks", { method: "POST", body: { promptId: p.id } });
      }
    } catch {
      setPrompts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, bookmarked: p.bookmarked } : x)),
      );
      toast("Bookmark failed", { kind: "error" });
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
      toast("Added to your diary");
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
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 pb-10 pt-8">
          {/* editorial masthead */}
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-light tracking-[-0.01em] text-ink">
                Gallery
              </h1>
              <p className="mt-1 text-sm text-dim">
                Open-source prompts and recipes shared by the community.
              </p>
            </div>
            {!session && (
              <Link
                href="/login"
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* search + sort stay pinned while the grid scrolls */}
          <div className="sticky top-0 z-10 -mx-1 bg-bg px-1 pb-3 pt-1">
            <div className="flex gap-2">
              <input
                className="input h-11 flex-1"
                placeholder={showRecipes ? "Search public recipes…" : "Search public prompts…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {!showRecipes && (
                <span className="flex h-11 items-center overflow-hidden rounded-lg border border-line-strong">
                  {(["copied", "new"] as const).map((s) => (
                    <button
                      key={s}
                      className={`h-full px-3.5 text-[13px] font-medium transition-colors ${
                        sort === s ? "bg-tint text-ink" : "text-dim hover:text-ink"
                      }`}
                      onClick={() => setSort(s)}
                    >
                      {s === "copied" ? "Most copied" : "Newest"}
                    </button>
                  ))}
                </span>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <button
                className={`chip cursor-pointer transition-colors ${
                  !showRecipes && !bookmarkedOnly ? "border-ink bg-tint text-ink" : "text-dim hover:text-ink"
                }`}
                onClick={() => {
                  setShowRecipes(false);
                  setBookmarkedOnly(false);
                }}
              >
                Prompts
              </button>
              <button
                className={`chip cursor-pointer transition-colors ${
                  showRecipes ? "border-ink bg-tint text-ink" : "text-dim hover:text-ink"
                }`}
                title="Public recipes — ordered prompt chains with their final output"
                onClick={() => setShowRecipes((v) => !v)}
              >
                Recipes
              </button>
              {session && (
                <button
                  className={`chip cursor-pointer transition-colors ${
                    bookmarkedOnly ? "border-ink bg-tint text-ink" : "text-dim hover:text-ink"
                  }`}
                  onClick={() => {
                    setShowRecipes(false);
                    setBookmarkedOnly((v) => !v);
                  }}
                >
                  ★ Bookmarked
                </button>
              )}
              {!showRecipes && (
                <>
                  <span className="mx-1 h-4 w-px bg-line-strong" aria-hidden />
                  {FACETS.map((f) => (
                    <button
                      key={f}
                      className={`chip cursor-pointer transition-colors ${
                        facetSel.includes(f)
                          ? "border-ink bg-tint text-ink"
                          : "text-dim hover:text-ink"
                      }`}
                      title={`Filter by ${f} style (detected from the prompt text)`}
                      onClick={() => toggleFacet(f)}
                    >
                      {f}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ---------- recipes: two-line editorial rows ---------- */}
          {showRecipes && (
            <div className="panel divide-y divide-line">
              {loading && (
                <div className="px-4 py-5">
                  <div className="skeleton h-4 w-2/5" />
                </div>
              )}
              {!loading && recipes.length === 0 && (
                <p className="py-14 text-center text-sm text-dim">
                  No public recipes{query ? " match your search" : " yet — publish one from a thread page"}.
                </p>
              )}
              {!loading &&
                recipes.map((r) => (
                  <Link
                    key={r.id}
                    href={`/r/${r.id}`}
                    className="ledger-row group flex w-full cursor-pointer flex-col gap-1 px-4 py-4 transition-colors duration-[120ms] ease-out hover:bg-[#fafafa]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-medium text-ink">{r.title}</span>
                      <span className="chip shrink-0">{r.stepCount} steps</span>
                      <span className="ml-auto shrink-0 text-xs text-dim">by {r.authorName}</span>
                    </span>
                    {r.finalOutput && (
                      <span className="line-clamp-2 font-mono text-xs leading-relaxed tracking-tight text-dim">
                        {r.finalOutput}
                      </span>
                    )}
                  </Link>
                ))}
            </div>
          )}

          {/* ---------- prompts: manuscript cards ---------- */}
          {!showRecipes && (
            <>
              {!loading && visible.length === 0 && (
                <p className="py-14 text-center text-sm text-dim">
                  {bookmarkedOnly
                    ? "No bookmarks yet — hover a card and hit the bookmark icon."
                    : `No public prompts${query || facetSel.length ? " match your filters" : " yet"}.`}
                </p>
              )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {loading &&
                  Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="rounded-2xl border border-line bg-raised p-6">
                      <div className="skeleton h-4 w-2/5" />
                      <div className="skeleton mt-3 h-16 w-full" />
                    </div>
                  ))}
                {!loading &&
                  visible.map((p) => (
                    <div
                      key={p.id}
                      className="ledger-row group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-line bg-raised p-6 transition-[box-shadow,border-color] duration-150 ease-out hover:border-line-strong hover:shadow-soft"
                      onClick={() => router.push(`/gallery/${p.id}`)}
                      title="Open"
                    >
                      <span className="flex items-center gap-1.5 pr-16">
                        {p.bookmarked && <Bookmark size={13} className="shrink-0 fill-brass text-brass" />}
                        <span className="truncate text-[16px] font-medium text-ink">{p.title}</span>
                      </span>
                      <p className="line-clamp-3 rounded-md bg-[#fafafa] p-2 font-mono text-[14px] leading-relaxed tracking-tight text-body">
                        {p.body}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        {(facetsById.get(p.id) ?? []).map((f) => (
                          <span key={f} className="chip">
                            {f}
                          </span>
                        ))}
                        {p.tags.slice(0, 3).map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                        <span className="ml-auto shrink-0 text-xs text-dim/80">
                          by {p.authorName}
                          {p.useCount > 0 && <span className="tabular-nums"> · {p.useCount}×</span>}
                        </span>
                      </div>
                      {session && ownedSourceIds.has(p.id) && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-success">
                          In your diary
                        </span>
                      )}
                      {/* hover-reveal actions — same language as My Prompts cards */}
                      <span
                        className="absolute right-3 top-3 hidden items-center gap-0.5 rounded-lg bg-raised group-hover:flex"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          aria-label="Copy prompt"
                          title={copiedId === p.id ? "Copied!" : "Copy prompt"}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-ink/[0.06] hover:text-ink"
                          onClick={() => copy(p)}
                        >
                          <Copy size={14} className={copiedId === p.id ? "text-success" : ""} />
                        </button>
                        <button
                          aria-label={p.bookmarked ? "Remove bookmark" : "Bookmark"}
                          title={p.bookmarked ? "Remove bookmark" : "Bookmark"}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-ink/[0.06] hover:text-ink"
                          onClick={() => void toggleBookmark(p)}
                        >
                          <Bookmark size={14} className={p.bookmarked ? "fill-brass text-brass" : ""} />
                        </button>
                        {session && !ownedSourceIds.has(p.id) && (
                          <button
                            className="ml-1 whitespace-nowrap rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-hover"
                            onClick={() => void addToDiary(p)}
                          >
                            + Add
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
