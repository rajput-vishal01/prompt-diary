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
  { label: "Teams", go: "/dashboard/teams" },
  { label: "Public Gallery", go: "/gallery" },
  { label: "Profile", go: "/dashboard/profile" },
];

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
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-raised shadow-[0_16px_48px_rgba(19,39,30,0.22)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[14px] outline-none placeholder:text-dim"
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
        <div className="max-h-72 overflow-y-auto py-1">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-dim">No matches.</p>
          )}
          {items.map((item, i) => (
            <button
              key={i}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${
                i === sel ? "bg-tint text-accent" : "text-ink hover:bg-hover"
              }`}
              onMouseEnter={() => setSel(i)}
              onClick={() => run(item, false)}
            >
              {item.kind === "prompt" && (
                <>
                  <span className="truncate font-medium">{item.prompt.title}</span>
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
