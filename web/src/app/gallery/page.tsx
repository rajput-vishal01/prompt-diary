"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Copy } from "lucide-react";
import type { Facet } from "shared";
import { FACETS, promptFacets } from "shared";
import { api } from "@/lib/client-api";
import { useApi } from "@/lib/query";
import { useSession } from "@/lib/auth-client";
import { PageVeil } from "@/components/PageVeil";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { Tip } from "@/components/ui/Tooltip";

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
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<Sort>("copied");
  const [facetSel, setFacetSel] = useState<Facet[]>([]);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // the filter state IS the cache key: previously-seen filter combos render
  // instantly from cache, new combos show the skeletons once
  const galleryPath = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (showRecipes) params.set("type", "threads");
    else {
      params.set("sort", sort);
      if (bookmarkedOnly) params.set("bookmarked", "1");
    }
    return `/api/v1/gallery?${params}`;
  }, [debouncedQuery, showRecipes, sort, bookmarkedOnly]);

  const { data: galleryData, isLoading: loading } = useApi<
    GalleryPrompt[] | GalleryRecipe[]
  >(galleryPath);
  const prompts = (showRecipes ? [] : (galleryData as GalleryPrompt[] | undefined)) ?? [];
  const recipes = (showRecipes ? (galleryData as GalleryRecipe[] | undefined) : undefined) ?? [];

  // which gallery prompts are already in my diary (by sourceId)
  const { data: minePrompts } = useApi<{ sourceId: string | null }[]>(
    "/api/v1/prompts",
    { enabled: !!session },
  );
  const ownedSourceIds = useMemo(
    () =>
      new Set(
        (minePrompts ?? []).map((p) => p.sourceId).filter((s): s is string => !!s),
      ),
    [minePrompts],
  );

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
    // count the copy — this powers the "most copied" sort
    void api("/api/v1/gallery/copied", { method: "POST", body: { promptId: p.id } }).catch(() => {});
  };

  const toggleBookmark = async (p: GalleryPrompt) => {
    if (!session) {
      toast("Sign in to bookmark prompts", { kind: "error" });
      return;
    }
    // optimistic — the icon must not lag the click
    const flip = (bookmarked: boolean) =>
      queryClient.setQueryData<GalleryPrompt[]>([galleryPath], (prev) =>
        prev?.map((x) => (x.id === p.id ? { ...x, bookmarked } : x)),
      );
    flip(!p.bookmarked);
    try {
      if (p.bookmarked) {
        await api(`/api/v1/gallery/bookmarks?promptId=${p.id}`, { method: "DELETE" });
      } else {
        await api("/api/v1/gallery/bookmarks", { method: "POST", body: { promptId: p.id } });
      }
    } catch {
      flip(p.bookmarked);
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
    } catch (e) {
      // only 409 "Already in your diary" means it's genuinely already owned;
      // any other failure must NOT lie that it was saved
      const already = e instanceof Error && e.message.includes("Already in your diary");
      if (!already) {
        toast(e instanceof Error ? e.message : "Could not add to your diary", { kind: "error" });
        return;
      }
    }
    // ownedSourceIds derives from /api/v1/prompts — refresh covers both the
    // fresh-add and the already-owned (409) paths
    void queryClient.invalidateQueries();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <PageVeil />
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

            {/* three distinct control genera, not one flat pill row:
                segmented tabs (what) · state toggle (whose) · facet chips (style) */}
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <span className="flex h-8 items-center overflow-hidden rounded-lg border border-line-strong">
                <button
                  className={`h-full px-3.5 text-[13px] font-medium transition-colors ${
                    !showRecipes ? "bg-tint text-ink" : "text-dim hover:text-ink"
                  }`}
                  aria-pressed={!showRecipes}
                  onClick={() => setShowRecipes(false)}
                >
                  Prompts
                </button>
                <Tip label="Public recipes — ordered prompt chains with their final output">
                  <button
                    className={`h-full px-3.5 text-[13px] font-medium transition-colors ${
                      showRecipes ? "bg-tint text-ink" : "text-dim hover:text-ink"
                    }`}
                    aria-pressed={showRecipes}
                    onClick={() => setShowRecipes(true)}
                  >
                    Recipes
                  </button>
                </Tip>
              </span>
              {session && !showRecipes && (
                <button
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                    bookmarkedOnly
                      ? "border-ink bg-tint text-ink"
                      : "border-line-strong text-dim hover:bg-hover hover:text-ink"
                  }`}
                  aria-pressed={bookmarkedOnly}
                  onClick={() => setBookmarkedOnly((v) => !v)}
                >
                  <Bookmark size={13} className={bookmarkedOnly ? "fill-brass text-brass" : ""} />
                  Bookmarked
                </button>
              )}
              {!showRecipes && (
                <span className="flex flex-wrap items-center gap-1.5 border-l border-line pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dim">
                    style
                  </span>
                  {FACETS.map((f) => (
                    <Tip key={f} label={`Filter by ${f} style (detected from the prompt text)`}>
                      <button
                        className={`chip cursor-pointer transition-colors ${
                          facetSel.includes(f)
                            ? "border-ink bg-tint text-ink"
                            : "text-dim hover:text-ink"
                        }`}
                        aria-pressed={facetSel.includes(f)}
                        onClick={() => toggleFacet(f)}
                      >
                        {f}
                      </button>
                    </Tip>
                  ))}
                </span>
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
                    className="ledger-row group flex w-full cursor-pointer flex-col gap-1 px-4 py-4 transition-colors duration-[120ms] ease-out hover:bg-soft"
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
                {!loading && (
                  <AnimatePresence mode="popLayout">
                  {visible.map((p, i) => (
                    <motion.div
                      key={p.id}
                      layout
                      // fresh cards stagger in; cards surviving a filter change
                      // keep their key and glide (layout) instead of re-entering
                      initial={reduce ? false : { opacity: 0, y: 14 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.35, delay: Math.min(i * 0.03, 0.25), ease: [0.23, 1, 0.32, 1] },
                      }}
                      exit={reduce ? undefined : { opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                      whileHover={reduce ? undefined : { y: -4, transition: { type: "spring", stiffness: 380, damping: 26 } }}
                      className="group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-line bg-raised p-6 transition-[box-shadow,border-color] duration-150 ease-out hover:border-line-strong hover:shadow-soft"
                      onClick={() => router.push(`/gallery/${p.id}`)}
                    >
                      <span className="flex items-center gap-1.5 pr-16">
                        {p.bookmarked && <Bookmark size={13} className="shrink-0 fill-brass text-brass" />}
                        <span className="truncate text-[16px] font-medium text-ink">{p.title}</span>
                      </span>
                      <p className="line-clamp-3 rounded-md bg-soft p-2 font-mono text-[14px] leading-relaxed tracking-tight text-body">
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
                        <span className="ml-auto shrink-0 text-xs text-dim">
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
                        <Tip label={copiedId === p.id ? "Copied ✓" : "Copy prompt"}>
                          <button
                            aria-label="Copy prompt"
                            className="icon-btn hover:bg-ink/[0.06] hover:text-ink"
                            onClick={() => copy(p)}
                          >
                            <Copy size={14} className={copiedId === p.id ? "text-success" : ""} />
                          </button>
                        </Tip>
                        <Tip label={p.bookmarked ? "Remove bookmark" : "Bookmark"}>
                          <button
                            aria-label={p.bookmarked ? "Remove bookmark" : "Bookmark"}
                            className="icon-btn hover:bg-ink/[0.06] hover:text-ink"
                            onClick={() => void toggleBookmark(p)}
                          >
                            <Bookmark size={14} className={p.bookmarked ? "fill-brass text-brass" : ""} />
                          </button>
                        </Tip>
                        {session && !ownedSourceIds.has(p.id) && (
                          <button
                            className="ml-1 whitespace-nowrap rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-hover"
                            onClick={() => void addToDiary(p)}
                          >
                            + Add
                          </button>
                        )}
                      </span>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
