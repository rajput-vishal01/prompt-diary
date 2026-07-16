"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Folder, Prompt } from "shared";
import { api } from "@/lib/client-api";
import { toast } from "@/components/Toast";

type Item =
  | { kind: "prompt"; prompt: Prompt }
  | { kind: "folder"; folder: Folder }
  | { kind: "action"; label: string; go: string };

const ACTIONS: Array<{ label: string; go: string }> = [
  { label: "New prompt", go: "/dashboard/new" },
  { label: "My Prompts", go: "/dashboard" },
  { label: "Projects", go: "/dashboard/projects" },
  { label: "Teams", go: "/dashboard/teams" },
  { label: "Usage", go: "/dashboard/usage" },
  { label: "Public Gallery", go: "/gallery" },
  { label: "Profile", go: "/dashboard/profile" },
];

// same desaturated source language as the list rows — never a filled color
const SOURCE_DOTS: Record<string, string> = {
  chatgpt: "hsl(160 25% 50%)",
  claude: "hsl(24 30% 55%)",
  gemini: "hsl(217 30% 58%)",
  perplexity: "hsl(190 25% 48%)",
  poe: "hsl(260 22% 56%)",
};

const siteOf = (p: Prompt) => p.tags.find((t) => t in SOURCE_DOTS) ?? null;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    setTimeout(() => inputRef.current?.focus(), 10);
    void api<Prompt[]>("/api/v1/prompts").then(setPrompts).catch(() => {});
    void api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    return [
      ...prompts
        .filter((p) => match(p.title) || p.tags.some(match))
        .slice(0, 7)
        .map((prompt): Item => ({ kind: "prompt", prompt })),
      ...folders
        .filter((f) => match(f.name))
        .slice(0, 4)
        .map((folder): Item => ({ kind: "folder", folder })),
      ...ACTIONS.filter((a) => match(a.label)).map(
        (a): Item => ({ kind: "action", ...a }),
      ),
    ];
  }, [query, prompts, folders]);

  useEffect(() => setSel(0), [query]);

  const run = (item: Item, openInstead: boolean) => {
    setOpen(false);
    if (item.kind === "prompt") {
      if (openInstead) {
        router.push(`/dashboard/p/${item.prompt.id}`);
      } else {
        void navigator.clipboard.writeText(item.prompt.body);
        toast(`Copied “${item.prompt.title}”`);
        void api(`/api/v1/prompts/${item.prompt.id}`, {
          method: "PATCH",
          body: { useCount: item.prompt.useCount + 1 },
        }).catch(() => {});
      }
    } else if (item.kind === "folder") {
      router.push(`/dashboard?folder=${item.folder.id}`);
    } else {
      router.push(item.go);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-ink/30 pt-[18vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-raised shadow-[0_16px_48px_rgba(12,10,9,0.18)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 44px launcher input with a persistent kbd hint — the popup's language */}
        <div className="relative border-b border-line">
          <input
            ref={inputRef}
            className="h-11 w-full bg-transparent pl-4 pr-16 text-[14px] outline-none placeholder:text-dim"
            placeholder="Search prompts, folders, actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && items[sel]) {
                e.preventDefault();
                run(items[sel], e.shiftKey);
              }
            }}
          />
          <span className="kbd pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            ↑↓ ↵
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-dim">No matches.</p>
          )}
          {items.map((item, i) => (
            <button
              key={i}
              // the 2px ink selection bar — same cursor vocabulary as every list
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors duration-[120ms] ${
                i === sel
                  ? "bg-[#fafafa] text-ink shadow-[inset_2px_0_0_#0c0a09]"
                  : "text-ink hover:bg-hover"
              }`}
              onMouseEnter={() => setSel(i)}
              onClick={() => run(item, false)}
            >
              {item.kind === "prompt" && (
                <>
                  <span className="truncate font-medium">{item.prompt.title}</span>
                  {siteOf(item.prompt) && (
                    <span className="chip shrink-0 gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: SOURCE_DOTS[siteOf(item.prompt)!] }}
                      />
                      {siteOf(item.prompt)}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-dim">copy ↵</span>
                </>
              )}
              {item.kind === "folder" && (
                <>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: item.folder.color }}
                  />
                  <span className="truncate">{item.folder.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-dim">folder</span>
                </>
              )}
              {item.kind === "action" && (
                <>
                  <span>{item.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-dim">action</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-3 border-t border-line px-4 py-2 text-xs text-dim">
          <span>
            <span className="kbd">↑↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> copy / go
          </span>
          <span>
            <span className="kbd">⇧↵</span> open
          </span>
          <span>
            <span className="kbd">esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}
