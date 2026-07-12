"use client";

import { useEffect, useMemo, useState } from "react";
import type { Folder, Prompt, Visibility } from "shared";
import { VISIBILITIES } from "shared";
import { api } from "@/lib/client-api";

interface TeamRow {
  id: string;
  name: string;
  role: "owner" | "member";
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [visFilter, setVisFilter] = useState("");
  const [editing, setEditing] = useState<Prompt | "new" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = () => {
    void api<Prompt[]>("/api/v1/prompts").then(setPrompts).catch(() => {});
    void api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});
    void api<TeamRow[]>("/api/v1/teams").then(setTeams).catch(() => {});
  };

  useEffect(reload, []);

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
    void api(`/api/v1/prompts/${p.id}`, {
      method: "PATCH",
      body: { useCount: p.useCount + 1 },
    }).then(reload);
  };

  const newFolder = async () => {
    const name = window.prompt("Folder name");
    if (name?.trim()) {
      await api("/api/v1/folders", { method: "POST", body: { name: name.trim() } });
      reload();
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Prompts</h1>
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

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="py-16 text-center text-dim">
            No prompts yet. Save one from the extension or click “New prompt”.
          </p>
        )}
        {filtered.map((p) => {
          const folder = folders.find((f) => f.id === p.folderId);
          return (
            <div key={p.id} className="card">
              <div className="flex items-center gap-2">
                {p.pinned && <span className="text-accent">★</span>}
                <h2 className="flex-1 truncate font-semibold">{p.title}</h2>
                {copiedId === p.id && (
                  <span className="text-xs font-semibold text-emerald-400">
                    Copied!
                  </span>
                )}
                <button className="btn" onClick={() => copy(p)}>
                  Copy
                </button>
                <button className="btn" onClick={() => setEditing(p)}>
                  Edit
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-dim">{p.body}</p>
              <div className="mt-3 flex items-center gap-2">
                {folder && (
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-xs"
                    style={{ borderColor: folder.color, color: folder.color }}
                  >
                    {folder.name}
                  </span>
                )}
                {p.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
                <span
                  className={`rounded-full border border-line px-2.5 py-0.5 text-xs capitalize ${
                    p.visibility === "public"
                      ? "text-emerald-400"
                      : p.visibility === "team"
                        ? "text-amber-400"
                        : "text-dim"
                  }`}
                >
                  {p.visibility}
                </span>
                <span className="ml-auto text-xs text-dim">
                  used {p.useCount}×
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
            reload();
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
      teamId: visibility === "team" ? teamId || null : null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
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
          className="input h-40 resize-none"
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
            <option value="team">Team</option>
            <option value="public">Public (open source)</option>
          </select>
          {visibility === "team" && (
            <select
              className="input"
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Pick team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-dim">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Pin to top
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          {prompt && (
            <button className="btn mr-auto text-red-400" onClick={() => void remove()}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!title.trim() || !body.trim() || (visibility === "team" && !teamId)}
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
