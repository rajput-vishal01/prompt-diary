"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Folder, Prompt } from "shared";
import { VISIBILITIES } from "shared";
import { api } from "@/lib/client-api";
import { toast } from "@/components/Toast";
import { FOLDERS_CHANGED_EVENT } from "@/components/Sidebar";

gsap.registerPlugin(useGSAP);

export default function PromptsPage() {
  return (
    <Suspense>
      <PromptsPageInner />
    </Suspense>
  );
}

function PromptsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderTab = searchParams.get("folder");
  const pinnedTab = searchParams.get("tab") === "pinned";

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [visFilter, setVisFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    void api<Prompt[]>("/api/v1/prompts")
      .then(setPrompts)
      .catch(() => {})
      .finally(() => setIsLoading(false));
    void api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(FOLDERS_CHANGED_EVENT, reload);
    // "/" focuses search from anywhere on the page
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(FOLDERS_CHANGED_EVENT, reload);
      window.removeEventListener("keydown", onKey);
    };
  }, [reload]);

  useGSAP(
    () => {
      if (isLoading || prompts.length === 0) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ".ledger-row",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: "power2.out" },
      );
    },
    { scope: listRef, dependencies: [isLoading] },
  );

  const activeFolder = folders.find((f) => f.id === folderTab) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (pinnedTab && !p.pinned) return false;
      if (folderTab && p.folderId !== folderTab) return false;
      if (visFilter && p.visibility !== visFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, pinnedTab, folderTab, visFilter]);

  const copy = (p: Prompt, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(p.body);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
    setPrompts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, useCount: x.useCount + 1 } : x)),
    );
    void api(`/api/v1/prompts/${p.id}`, {
      method: "PATCH",
      body: { useCount: p.useCount + 1 },
    }).catch(() => {});
  };

  const newHref = `/dashboard/new${folderTab ? `?folder=${folderTab}` : ""}`;
  const isTrueFirstRun = !isLoading && prompts.length === 0;

  // backward thread assembly: saves stamped with the same conversation
  // fingerprint cluster themselves — offer to chain them into a thread
  const cluster = useMemo(() => {
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(localStorage.getItem("pd-dismissed-convos") ?? "[]");
    } catch {
      /* fresh start */
    }
    const groups = new Map<string, Prompt[]>();
    for (const p of prompts) {
      if (!p.sourceConvo || dismissed.includes(p.sourceConvo)) continue;
      groups.set(p.sourceConvo, [...(groups.get(p.sourceConvo) ?? []), p]);
    }
    let best: Prompt[] | null = null;
    for (const g of groups.values()) {
      if (g.length >= 2 && (!best || g.length > best.length)) best = g;
    }
    return best;
  }, [prompts]);

  const dismissCluster = () => {
    if (!cluster?.[0]?.sourceConvo) return;
    const key = cluster[0].sourceConvo;
    const prev = JSON.parse(localStorage.getItem("pd-dismissed-convos") ?? "[]") as string[];
    localStorage.setItem("pd-dismissed-convos", JSON.stringify([...prev, key]));
    void reload();
  };

  const chainCluster = async () => {
    if (!cluster) return;
    const ordered = [...cluster].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const first = ordered[0];
    if (!first) return;
    const site = first.tags.find((t) =>
      ["chatgpt", "claude", "gemini", "perplexity", "poe"].includes(t),
    );
    const t = await api<{ id: string }>("/api/v1/threads", {
      method: "POST",
      body: {
        title: `${first.title.slice(0, 60)} — thread`,
        promptIds: ordered.map((p) => p.id),
      },
    });
    dismissCluster();
    toast(`Thread created from ${ordered.length} ${site ?? "chat"} saves`);
    router.push(`/dashboard/t/${t.id}`);
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">
          {pinnedTab ? "Pinned" : (activeFolder?.name ?? "My Prompts")}
          {!isLoading && (
            <span className="ml-2 text-[13px] font-normal tabular-nums text-dim">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </h1>
        <button className="btn-primary" onClick={() => router.push(newHref)}>
          + New prompt{activeFolder ? ` in ${activeFolder.name}` : ""}
        </button>
      </div>

      {cluster && (
        <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-accent/40 bg-tint px-4 py-2.5 text-[13px]">
          <span className="flex-1">
            <b>{cluster.length} saves</b> came from the same conversation — chain
            them into a thread?
          </span>
          <button className="btn-primary h-7 px-3 text-[12px]" onClick={() => void chainCluster()}>
            Chain into thread
          </button>
          <button className="text-dim hover:text-ink" title="Dismiss" onClick={dismissCluster}>
            ✕
          </button>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            className="input pr-8"
            placeholder="Search prompts, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">/</span>
        </div>
        <select
          className="input w-32"
          value={visFilter}
          onChange={(e) => setVisFilter(e.target.value)}
        >
          <option value="">All visibility</option>
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={listRef}
        className="panel min-h-0 flex-1 divide-y divide-line overflow-y-auto"
      >
        {isLoading &&
          Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="px-4 py-2.5">
              <div className="skeleton h-4 w-2/5" />
            </div>
          ))}

        {isTrueFirstRun && (
          <div className="mx-auto max-w-md py-14 text-center">
            <p className="font-display text-xl italic">Start your diary</p>
            <ol className="mt-4 space-y-3 text-left text-[13px] leading-relaxed text-dim">
              <li>
                <span className="font-semibold text-ink">1 · Install the extension</span>
                <br />
                Load Prompt Diary in Chrome and pin it to your toolbar.
              </li>
              <li>
                <span className="font-semibold text-ink">2 · Highlight any prompt</span>
                <br />
                On ChatGPT or Claude, select text → click the <span className="text-accent">Pd</span> bubble
                (or right-click → Save to Prompt Diary).
              </li>
              <li>
                <span className="font-semibold text-ink">3 · It syncs here</span>
                <br />
                Organize with folders and tags, then copy it back into any chat in one click.
              </li>
            </ol>
            <button className="btn-primary mt-5" onClick={() => router.push(newHref)}>
              Or write your first prompt
            </button>
          </div>
        )}

        {!isLoading && !isTrueFirstRun && filtered.length === 0 && (
          <p className="py-14 text-center text-[13px] text-dim">
            {folderTab
              ? "This folder is empty — “New prompt” adds straight into it."
              : "Nothing matches your filters."}
          </p>
        )}

        {!isLoading &&
          filtered.map((p) => {
            const folder = folders.find((f) => f.id === p.folderId);
            return (
              <div
                key={p.id}
                className="ledger-row group flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-hover"
                onClick={() => router.push(`/dashboard/p/${p.id}`)}
                title="Open"
              >
                {p.pinned && <span className="text-[11px] text-accent">★</span>}
                <span className="truncate text-[13px] font-semibold">{p.title}</span>
                <span
                  className={`vis-badge shrink-0 ${
                    p.visibility === "public" ? "text-accent" : "text-dim"
                  }`}
                >
                  {p.visibility}
                </span>
                {p.teamId && <span className="vis-badge shrink-0 text-amber">team</span>}
                {folder && !folderTab && (
                  <span
                    className="shrink-0 text-[11px] font-semibold"
                    style={{ color: folder.color }}
                  >
                    {folder.name}
                  </span>
                )}
                {p.tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip shrink-0">
                    {t}
                  </span>
                ))}
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {copiedId === p.id ? (
                    <span className="text-[11px] font-bold text-accent">Copied</span>
                  ) : (
                    <button className="btn h-6 px-2 text-[11px]" onClick={(e) => copy(p, e)}>
                      Copy
                    </button>
                  )}
                  <span className="w-8 text-right text-[11px] tabular-nums text-dim">
                    {p.useCount > 0 ? `${p.useCount}×` : ""}
                  </span>
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
