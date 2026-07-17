"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Check, Copy, Globe, Lock, MoreHorizontal, Users } from "lucide-react";
import type { Folder, Prompt } from "shared";
import { FACETS, VISIBILITIES, promptFacets } from "shared";
import { api } from "@/lib/client-api";
import { SOURCE_DOTS, relativeTime, sourceOf } from "@/lib/sources";
import { toast } from "@/components/Toast";
import { Select } from "@/components/ui/Select";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { Tip } from "@/components/ui/Tooltip";
import { FOLDERS_CHANGED_EVENT } from "@/components/Sidebar";

gsap.registerPlugin(useGSAP);

const emitChanged = () => window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));

const excerptOf = (p: Prompt) => p.body.replace(/\s+/g, " ").trim();

// icon carries visibility; the word lives in the tooltip only
function VisibilityIcon({ p }: { p: Prompt }) {
  if (p.visibility === "public")
    return <Globe size={14} className="shrink-0 text-dim" aria-label="public"><title>public</title></Globe>;
  if (p.teamId)
    return <Users size={14} className="shrink-0 text-dim" aria-label="team"><title>shared with team</title></Users>;
  return <Lock size={14} className="shrink-0 text-dim" aria-label="private"><title>private</title></Lock>;
}

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
  const activeTag = searchParams.get("tag"); // set from the sidebar Tags section

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [visFilter, setVisFilter] = useState("");
  const [view, setView] = useState<"list" | "cards">("list");
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
    if (localStorage.getItem("pd-view") === "cards") setView("cards");
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

  // style facets are computed from the text, never stored
  const facetsById = useMemo(
    () => new Map(prompts.map((p) => [p.id, promptFacets(p.body)])),
    [prompts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (pinnedTab && !p.pinned) return false;
      if (folderTab && p.folderId !== folderTab) return false;
      if (visFilter && p.visibility !== visFilter) return false;
      if (activeTag) {
        // a sidebar tag is either a computed facet or a literal tag
        const isFacet = (FACETS as readonly string[]).includes(activeTag);
        if (isFacet && !facetsById.get(p.id)?.includes(activeTag as never)) return false;
        if (!isFacet && !p.tags.includes(activeTag)) return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, pinnedTab, folderTab, visFilter, activeTag, facetsById]);

  const setViewMode = (v: "list" | "cards") => {
    setView(v);
    localStorage.setItem("pd-view", v);
  };

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

  const duplicate = async (p: Prompt) => {
    await api("/api/v1/prompts", {
      method: "POST",
      body: {
        title: `${p.title.slice(0, 190)} (copy)`,
        body: p.body,
        tags: p.tags,
        folderId: p.folderId,
        visibility: "private",
      },
    });
    toast("Duplicated");
    reload();
    emitChanged();
  };

  const moveToFolder = async (p: Prompt, folderId: string | null) => {
    await api(`/api/v1/prompts/${p.id}`, { method: "PATCH", body: { folderId } });
    toast(folderId ? "Moved" : "Removed from folder");
    reload();
  };

  const remove = async (p: Prompt) => {
    await api(`/api/v1/prompts/${p.id}`, { method: "DELETE" });
    reload();
    emitChanged();
    toast(`Deleted "${p.title.slice(0, 40)}"`, {
      action: {
        label: "Undo",
        onClick: () => {
          void api(`/api/v1/prompts/${p.id}/restore`, { method: "POST" }).then(() => {
            reload();
            emitChanged();
          });
        },
      },
    });
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
    const site = first.tags.find((t) => t in SOURCE_DOTS);
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

  // hover-revealed icon actions shared by both views
  const RowActions = ({ p, ghostBg }: { p: Prompt; ghostBg?: boolean }) => (
    <span className="relative flex shrink-0 items-center gap-0.5">
      <Tip label={copiedId === p.id ? "Copied ✓" : "Copy prompt"}>
        <button
          aria-label="Copy prompt"
          className={`icon-btn hover:bg-ink/[0.06] hover:text-ink ${ghostBg ? "bg-raised/90" : ""}`}
          onClick={(e) => copy(p, e)}
        >
          {copiedId === p.id ? <Check size={15} className="text-success" /> : <Copy size={15} />}
        </button>
      </Tip>
      <Menu
        trigger={
          <button
            aria-label="More actions"
            className={`icon-btn hover:bg-ink/[0.06] hover:text-ink data-[state=open]:bg-ink/[0.06] data-[state=open]:text-ink ${ghostBg ? "bg-raised/90" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={15} />
          </button>
        }
      >
        <MenuItem onSelect={() => void duplicate(p)}>Duplicate</MenuItem>
        <MenuSeparator />
        <MenuLabel>Move to folder</MenuLabel>
        {p.folderId && <MenuItem onSelect={() => void moveToFolder(p, null)}>No folder</MenuItem>}
        {folders
          .filter((f) => f.id !== p.folderId)
          .map((f) => (
            <MenuItem key={f.id} onSelect={() => void moveToFolder(p, f.id)}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: f.color }} />
              <span className="truncate">{f.name}</span>
            </MenuItem>
          ))}
        <MenuSeparator />
        <MenuItem danger onSelect={() => void remove(p)}>
          Delete
        </MenuItem>
      </Menu>
    </span>
  );

  const sourceBadge = (p: Prompt) => {
    const site = sourceOf(p);
    if (!site) return null;
    return (
      <span className="chip shrink-0 gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_DOTS[site] }} />
        {site}
      </span>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      <div className="mb-4 flex items-baseline justify-between">
        {/* the one Waldenburg moment on this page */}
        <h1 className="font-display text-2xl font-light tracking-[-0.015em]">
          {pinnedTab ? "Pinned" : (activeFolder?.name ?? "My Prompts")}
          {!isLoading && (
            <span className="ml-2.5 font-sans text-sm font-normal tabular-nums text-dim">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </h1>
        <button className="btn-primary" onClick={() => router.push(newHref)}>
          + New prompt{activeFolder ? ` in ${activeFolder.name}` : ""}
        </button>
      </div>

      {cluster && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-line-strong bg-tint px-4 py-2.5 text-sm">
          <span className="flex-1">
            <b>{cluster.length} saves</b> came from the same conversation — chain
            them into a thread?
          </span>
          <button className="btn-primary h-7 px-3 text-[13px]" onClick={() => void chainCluster()}>
            Chain into thread
          </button>
          <button className="text-dim hover:text-ink" aria-label="Dismiss" onClick={dismissCluster}>
            ✕
          </button>
        </div>
      )}

      {/* search stays pinned while the list scrolls */}
      <div className="sticky -top-8 z-10 -mx-1 bg-bg px-1 pb-3 pt-1">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              className="input h-11 pr-8"
              placeholder="Search prompts, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="kbd absolute right-3 top-1/2 -translate-y-1/2">/</span>
          </div>
          <Select
            className="h-11 w-36"
            ariaLabel="Filter by visibility"
            value={visFilter}
            onValueChange={setVisFilter}
            options={[
              { value: "", label: "All visibility" },
              ...VISIBILITIES.map((v) => ({ value: v, label: v })),
            ]}
          />
          <span className="flex h-11 items-center overflow-hidden rounded-lg border border-line-strong">
            {(["list", "cards"] as const).map((v) => (
              <button
                key={v}
                className={`h-full px-3.5 text-[13px] font-medium transition-colors ${
                  view === v ? "bg-tint text-ink" : "text-dim hover:text-ink"
                }`}
                onClick={() => setViewMode(v)}
              >
                {v === "list" ? "List" : "Cards"}
              </button>
            ))}
          </span>
        </div>
        {activeTag && (
          <div className="mt-2.5">
            <Tip label="Clear tag filter">
              <button className="chip gap-1.5 transition-[background-color,transform] hover:bg-hover active:scale-[0.97]" onClick={() => router.push("/dashboard")}>
                Tag: {activeTag} <span className="text-dim">×</span>
              </button>
            </Tip>
          </div>
        )}
      </div>

      <div
        ref={listRef}
        className={`min-h-0 flex-1 overflow-y-auto ${
          view === "list" ? "panel divide-y divide-line" : ""
        }`}
      >
        {isLoading &&
          Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="px-4 py-5">
              <div className="skeleton h-4 w-2/5" />
            </div>
          ))}

        {isTrueFirstRun && (
          <div className="mx-auto max-w-md py-14 text-center">
            <p className="font-display text-xl font-light">Start your diary</p>
            <ol className="mt-4 space-y-3 text-left text-sm leading-relaxed text-dim">
              <li>
                <span className="font-semibold text-ink">1 · Install the extension</span>
                <br />
                Load Prompt Diary in Chrome and pin it to your toolbar.
              </li>
              <li>
                <span className="font-semibold text-ink">2 · Highlight any prompt</span>
                <br />
                On ChatGPT or Claude, select text → click the <span className="font-semibold">Pd</span> bubble
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
          <p className="py-14 text-center text-sm text-dim">
            {folderTab
              ? "This folder is empty — “New prompt” adds straight into it."
              : "Nothing matches your filters."}
          </p>
        )}

        {/* ---------- LIST: 64px two-line manuscript rows ---------- */}
        {!isLoading && view === "list" &&
          filtered.map((p) => (
            <div
              key={p.id}
              className="ledger-row group relative flex h-16 w-full cursor-pointer items-center gap-4 px-4 transition-colors duration-[120ms] ease-out hover:bg-soft"
              onClick={() => router.push(`/dashboard/p/${p.id}`)}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {p.pinned && <span className="text-xs text-brass">★</span>}
                  <span className="truncate text-[16px] font-medium leading-6 text-ink">
                    {p.title}
                  </span>
                </span>
                <span className="block truncate text-sm leading-5 text-dim">
                  {excerptOf(p)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {sourceBadge(p)}
                <Tip label={p.visibility === "public" ? "public" : p.teamId ? "shared with team" : "private"}>
                  <span tabIndex={-1}>
                    <VisibilityIcon p={p} />
                  </span>
                </Tip>
                {p.useCount > 0 && (
                  <Tip label={`Copied ${p.useCount} time${p.useCount === 1 ? "" : "s"}`}>
                    <span className="text-[11px] font-semibold uppercase tabular-nums tracking-wide text-dim">
                      {p.useCount}×
                    </span>
                  </Tip>
                )}
              </span>
              {/* absolute overlay on the hover bg — appearing must not shift
                  the meta cluster or re-truncate the title (checklist C) */}
              <span className="absolute bottom-0 right-4 top-0 hidden items-center bg-soft pl-2 group-hover:flex">
                <RowActions p={p} />
              </span>
            </div>
          ))}

        {/* ---------- CARDS: manuscript excerpts ---------- */}
        {!isLoading && view === "cards" && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="ledger-row group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-line bg-raised p-6 transition-[box-shadow,border-color] duration-150 ease-out hover:border-line-strong hover:shadow-soft"
                onClick={() => router.push(`/dashboard/p/${p.id}`)}
              >
                <span className="flex items-center gap-1.5 pr-8">
                  {p.pinned && <span className="text-xs text-brass">★</span>}
                  <span className="truncate text-[16px] font-medium text-ink">{p.title}</span>
                </span>
                {/* the manuscript excerpt — the one deliberate signature detail */}
                <p className="line-clamp-3 rounded-md bg-soft p-2 font-mono text-[15px] leading-relaxed tracking-tight text-body">
                  {excerptOf(p)}
                </p>
                <div className="mt-auto flex items-center gap-1.5">
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-dim">
                    <span title={p.visibility === "public" ? "public" : p.teamId ? "shared with team" : "private"}>
                      <VisibilityIcon p={p} />
                    </span>
                    Edited {relativeTime(p.updatedAt)}
                  </span>
                </div>
                {/* hover-reveal copy — same interaction language as the list */}
                <span className="absolute right-3 top-3 hidden group-hover:flex">
                  <RowActions p={p} ghostBg />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
