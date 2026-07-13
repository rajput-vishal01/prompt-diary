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

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [visFilter, setVisFilter] = useState("");
  const [editing, setEditing] = useState<Prompt | "new" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const reloadPrompts = () =>
    api<Prompt[]>("/api/v1/prompts")
      .then(setPrompts)
      .catch(() => {})
      .finally(() => setIsLoading(false));

  useEffect(() => {
    void reloadPrompts();
    void api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});
    void api<TeamRow[]>("/api/v1/teams").then(setTeams).catch(() => {});
  }, []);

  // stagger the ledger rows in once, after the first load
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (folderFilter && p.folderId !== folderFilter) return false;
      if (visFilter && p.visibility !== visFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, folderFilter, visFilter]);

  const copy = (p: Prompt) => {
    void navigator.clipboard.writeText(p.body);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
    // optimistic bump — no refetch, the list must not flash
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
      await api("/api/v1/folders", { method: "POST", body: { name: name.trim() } });
      void api<Folder[]>("/api/v1/folders").then(setFolders);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          My Prompts
          {!isLoading && (
            <span className="ml-2 text-sm font-normal tabular-nums text-dim">
              {prompts.length} {prompts.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </h1>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          + New prompt
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
          className="input w-44"
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
        >
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
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
        <button className="btn" onClick={() => void newFolder()}>
          + Folder
        </button>
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
                  {folder && (
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

      {editing && (
        <PromptModal
          prompt={editing === "new" ? null : editing}
          folders={folders}
          teams={teams}
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

function PromptModal({
  prompt,
  folders,
  teams,
  onClose,
  onSaved,
}: {
  prompt: Prompt | null;
  folders: Folder[];
  teams: TeamRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [tags, setTags] = useState(prompt?.tags.join(", ") ?? "");
  const [folderId, setFolderId] = useState(prompt?.folderId ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    prompt?.visibility ?? "private",
  );
  const [teamId, setTeamId] = useState(prompt?.teamId ?? "");
  const [pinned, setPinned] = useState(prompt?.pinned ?? false);
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
      teamId: teamId || null, // independent of visibility — can be public AND team-shared
      pinned,
    };
    try {
      if (prompt) {
        await api(`/api/v1/prompts/${prompt.id}`, {
          method: "PATCH",
          body: payload,
        });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
      <div className="w-full max-w-xl space-y-3 rounded-xl border border-line bg-raised p-6">
        <h2 className="text-lg font-bold">
          {prompt ? "Edit prompt" : "New prompt"}
        </h2>
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className="input h-40 resize-none font-mono text-xs leading-relaxed"
          placeholder="Your prompt…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          className="input"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="flex gap-3">
          <select
            className="input"
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
            className="input"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            <option value="private">Private (closed)</option>
            <option value="public">Public (open source)</option>
          </select>
          <select
            className="input"
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
        </div>
        <label className="flex items-center gap-2 text-sm text-dim">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Pin to top
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          {prompt && (
            <button className="btn mr-auto text-danger" onClick={() => void remove()}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!title.trim() || !body.trim()}
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
