"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Folder, Prompt, Visibility } from "shared";
import { VISIBILITIES } from "shared";
import { api } from "@/lib/client-api";

gsap.registerPlugin(useGSAP);

interface TeamRow {
  id: string;
  name: string;
  role: "owner" | "member";
}

// rail tabs: "all" | "pinned" | <folderId>
const ALL = "all";
const PINNED = "pinned";

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<string>(ALL);
  const [visFilter, setVisFilter] = useState("");
  const [editing, setEditing] = useState<Prompt | "new" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const reloadPrompts = () =>
    api<Prompt[]>("/api/v1/prompts")
      .then(setPrompts)
      .catch(() => {})
      .finally(() => setIsLoading(false));

  const reloadFolders = () =>
    api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});

  useEffect(() => {
    void reloadPrompts();
    void reloadFolders();
    void api<TeamRow[]>("/api/v1/teams").then(setTeams).catch(() => {});
  }, []);

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

  const activeFolder = folders.find((f) => f.id === tab) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (tab === PINNED && !p.pinned) return false;
      if (tab !== ALL && tab !== PINNED && p.folderId !== tab) return false;
      if (visFilter && p.visibility !== visFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, tab, visFilter]);

  const copy = (p: Prompt) => {
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

  const newFolder = async () => {
    const name = window.prompt("Folder name");
    if (name?.trim()) {
      const folder = await api<Folder>("/api/v1/folders", {
        method: "POST",
        body: { name: name.trim() },
      });
      await reloadFolders();
      setTab(folder.id); // jump straight into the new folder
    }
  };

  const renameFolder = async (f: Folder) => {
    const name = window.prompt("Rename folder", f.name);
    if (name?.trim() && name.trim() !== f.name) {
      await api(`/api/v1/folders/${f.id}`, {
        method: "PATCH",
        body: { name: name.trim() },
      });
      void reloadFolders();
    }
  };

  const deleteFolder = async (f: Folder) => {
    if (!window.confirm(`Delete folder "${f.name}"? Prompts inside are kept.`)) return;
    await api(`/api/v1/folders/${f.id}`, { method: "DELETE" });
    if (tab === f.id) setTab(ALL);
    void reloadFolders();
    void reloadPrompts();
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl gap-5">
      {/* folder rail — discord-style, one tab per folder */}
      <aside className="flex w-14 shrink-0 flex-col items-center gap-2 overflow-y-auto py-1">
        <RailButton
          label="All prompts"
          active={tab === ALL}
          onClick={() => setTab(ALL)}
        >
          <span className="font-display italic">Pd</span>
        </RailButton>
        <RailButton
          label="Pinned"
          active={tab === PINNED}
          onClick={() => setTab(PINNED)}
        >
          ★
        </RailButton>
        <div className="my-1 h-px w-8 bg-line" />
        {folders.map((f) => (
          <RailButton
            key={f.id}
            label={`${f.name} — double-click to rename, right-click to delete`}
            active={tab === f.id}
            color={f.color}
            onClick={() => setTab(f.id)}
            onDoubleClick={() => void renameFolder(f)}
            onContextMenu={(e) => {
              e.preventDefault();
              void deleteFolder(f);
            }}
          >
            {f.name.charAt(0).toUpperCase()}
          </RailButton>
        ))}
        <button
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-line text-dim transition-colors hover:border-accent hover:text-accent"
          title="New folder"
          onClick={() => void newFolder()}
        >
          +
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">
            {tab === ALL ? "My Prompts" : tab === PINNED ? "Pinned" : activeFolder?.name}
            {!isLoading && (
              <span className="ml-2 text-sm font-normal tabular-nums text-dim">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </h1>
          <button className="btn-primary" onClick={() => setEditing("new")}>
            + New prompt{activeFolder ? ` in ${activeFolder.name}` : ""}
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Search prompts, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input w-36"
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

        {/* only this list scrolls — never the page chrome */}
        <div
          ref={listRef}
          className="min-h-0 flex-1 divide-y divide-line overflow-y-auto rounded-[10px] border border-line bg-raised"
        >
          {isLoading &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="skeleton h-4 w-2/5" />
                <div className="skeleton mt-2 h-3 w-4/5" />
                <div className="skeleton mt-2 h-3 w-1/4" />
              </div>
            ))}
          {!isLoading && filtered.length === 0 && (
            <p className="py-16 text-center text-sm text-dim">
              {prompts.length === 0
                ? "No prompts yet. Save one from the extension or click “New prompt”."
                : tab !== ALL && tab !== PINNED
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
                  className="ledger-row group px-4 py-3 transition-colors hover:bg-hover"
                >
                  <div className="flex items-baseline gap-2">
                    {p.pinned && <span className="text-xs text-accent">★</span>}
                    <h2 className="flex-1 truncate text-sm font-semibold">{p.title}</h2>
                    {copiedId === p.id && (
                      <span className="text-xs font-bold text-accent">Copied</span>
                    )}
                    <span className="flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <button className="btn px-2 py-0.5 text-xs" onClick={() => copy(p)}>
                        Copy
                      </button>
                      <button
                        className="btn px-2 py-0.5 text-xs"
                        onClick={() => setEditing(p)}
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-xs leading-relaxed text-dim">
                    {p.body}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className={`vis-badge ${
                        p.visibility === "public" ? "text-accent" : "text-dim"
                      }`}
                    >
                      {p.visibility}
                    </span>
                    {p.teamId && <span className="vis-badge text-amber">team</span>}
                    {folder && tab === ALL && (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: folder.color }}
                      >
                        {folder.name}
                      </span>
                    )}
                    {p.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto text-xs tabular-nums text-dim">
                      {p.useCount > 0 ? `${p.useCount}×` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {editing && (
        <PromptDetail
          prompt={editing === "new" ? null : editing}
          folders={folders}
          teams={teams}
          defaultFolderId={tab !== ALL && tab !== PINNED ? tab : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reloadPrompts();
          }}
        />
      )}
    </div>
  );
}

function RailButton({
  label,
  active,
  color,
  children,
  ...handlers
}: {
  label: string;
  active: boolean;
  color?: string;
  children: React.ReactNode;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-all ${
        active
          ? "bg-tint text-accent ring-2 ring-accent"
          : "border border-line bg-raised text-dim hover:border-accent hover:text-ink"
      }`}
      style={color && !active ? { color } : undefined}
      {...handlers}
    >
      {children}
    </button>
  );
}

function PromptDetail({
  prompt,
  folders,
  teams,
  defaultFolderId,
  onClose,
  onSaved,
}: {
  prompt: Prompt | null;
  folders: Folder[];
  teams: TeamRow[];
  defaultFolderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [tags, setTags] = useState(prompt?.tags.join(", ") ?? "");
  const [folderId, setFolderId] = useState(prompt?.folderId ?? defaultFolderId ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    prompt?.visibility ?? "private",
  );
  const [teamId, setTeamId] = useState(prompt?.teamId ?? "");
  const [pinned, setPinned] = useState(prompt?.pinned ?? false);
  const [outputBefore, setOutputBefore] = useState(prompt?.outputBefore ?? "");
  const [outputAfter, setOutputAfter] = useState(prompt?.outputAfter ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const payload = {
      title: title.trim(),
      body: body.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
      folderId: folderId || null,
      visibility,
      teamId: teamId || null,
      pinned,
      outputBefore: outputBefore.trim() || null,
      outputAfter: outputAfter.trim() || null,
    };
    try {
      if (prompt) {
        await api(`/api/v1/prompts/${prompt.id}`, { method: "PATCH", body: payload });
      } else {
        await api("/api/v1/prompts", { method: "POST", body: payload });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const remove = async () => {
    if (!prompt || !window.confirm("Delete this prompt?")) return;
    await api(`/api/v1/prompts/${prompt.id}`, { method: "DELETE" });
    onSaved();
  };

  return (
    // full-page takeover: outputs are the star, the prompt is the instrument
    <div className="fixed inset-0 z-50 flex flex-col bg-bg p-6">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <button className="btn" onClick={onClose}>
            ← Back
          </button>
          <input
            className="input flex-1 text-base font-semibold"
            placeholder="Prompt title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={!prompt}
          />
          {prompt && (
            <button className="btn text-danger" onClick={() => void remove()}>
              Delete
            </button>
          )}
          <button
            className="btn-primary px-5"
            disabled={!title.trim() || !body.trim()}
            onClick={() => void save()}
          >
            Save
          </button>
        </div>

        {/* the proof: what the model did before vs after this prompt */}
        <div className="grid min-h-0 flex-[1.2] grid-cols-2 gap-4">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-raised">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-dim">
              BEFORE — output without this prompt
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-dim"
              placeholder="Paste a sample of what the model gave you before…"
              value={outputBefore}
              onChange={(e) => setOutputBefore(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-accent/40 bg-raised">
            <div className="border-b border-line bg-tint px-3 py-2 text-xs font-semibold text-accent">
              AFTER — output with this prompt
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-dim"
              placeholder="…and the improved output it produced."
              value={outputAfter}
              onChange={(e) => setOutputAfter(e.target.value)}
            />
          </div>
        </div>

        {/* the prompt itself */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-raised">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold text-dim">
            THE PROMPT
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-dim"
            placeholder="Your prompt…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-56"
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <select
            className="input max-w-44"
            value={folderId ?? ""}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            className="input max-w-44"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            <option value="private">Private (closed)</option>
            <option value="public">Public (open source)</option>
          </select>
          <select
            className="input max-w-44"
            value={teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Share: {t.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-dim">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
