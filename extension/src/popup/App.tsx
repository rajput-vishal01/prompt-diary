import { useEffect, useMemo, useState } from "react";
import type { Folder, Prompt } from "shared";
import {
  addFolder,
  addPrompt,
  bumpUseCount,
  deleteFolder,
  deletePrompt,
  getVault,
  updatePrompt,
  type NewPrompt,
  type Vault,
} from "../lib/vault";
import { PromptCard } from "./PromptCard";
import { PromptEditor } from "./PromptEditor";

type Filter = "all" | "pinned" | { folderId: string };

export function App() {
  const [vault, setVaultState] = useState<Vault | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Prompt | "new" | null>(null);

  const reload = () => void getVault().then(setVaultState);

  useEffect(() => {
    reload();
    // context-menu saves happen in the background worker; refresh live
    const onChange = (_: unknown, area: string) => {
      if (area === "local") reload();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const prompts = useMemo(() => {
    if (!vault) return [];
    let list = vault.prompts;
    if (filter === "pinned") list = list.filter((p) => p.pinned);
    else if (filter !== "all") list = list.filter((p) => p.folderId === filter.folderId);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [vault, filter, query]);

  if (!vault) return null;

  const handleSave = async (input: NewPrompt, existing: Prompt | null) => {
    if (existing) await updatePrompt(existing.id, input);
    else await addPrompt(input);
    setEditing(null);
    reload();
  };

  const handleDelete = async (id: string) => {
    await deletePrompt(id);
    setEditing(null);
    reload();
  };

  const handleCopy = async (prompt: Prompt) => {
    await navigator.clipboard.writeText(prompt.body);
    await bumpUseCount(prompt.id);
    reload();
  };

  const handleNewFolder = async () => {
    const name = window.prompt("Folder name");
    if (name?.trim()) {
      await addFolder(name.trim());
      reload();
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (window.confirm(`Delete folder "${folder.name}"? Prompts inside are kept.`)) {
      await deleteFolder(folder.id);
      if (filter !== "all" && filter !== "pinned" && filter.folderId === folder.id) {
        setFilter("all");
      }
      reload();
    }
  };

  return (
    <div className="app" style={{ position: "relative" }}>
      <aside className="sidebar">
        <div className="brand">
          Prompt<span>Diary</span>
        </div>
        <button
          className={`nav-item ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          <span className="label">All prompts</span>
        </button>
        <button
          className={`nav-item ${filter === "pinned" ? "active" : ""}`}
          onClick={() => setFilter("pinned")}
        >
          <span className="label">Pinned</span>
        </button>

        <div className="sidebar-section">Folders</div>
        {vault.folders.map((f) => (
          <button
            key={f.id}
            className={`nav-item ${
              filter !== "all" && filter !== "pinned" && filter.folderId === f.id
                ? "active"
                : ""
            }`}
            onClick={() => setFilter({ folderId: f.id })}
            onContextMenu={(e) => {
              e.preventDefault();
              void handleDeleteFolder(f);
            }}
            title={`${f.name} (right-click to delete)`}
          >
            <span className="dot" style={{ background: f.color }} />
            <span className="label">{f.name}</span>
          </button>
        ))}
        <button className="nav-item add-folder" onClick={() => void handleNewFolder()}>
          + New folder
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <input
            className="search"
            placeholder="Search prompts, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary" onClick={() => setEditing("new")}>
            + New
          </button>
        </div>

        <div className="list">
          {prompts.length === 0 ? (
            <div className="empty">
              <strong>No prompts here yet.</strong>
              <br />
              Highlight text on any page → right-click →{" "}
              <em>Save to Prompt Diary</em>, or click <em>+ New</em>.
            </div>
          ) : (
            prompts.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                folders={vault.folders}
                onCopy={() => void handleCopy(p)}
                onEdit={() => setEditing(p)}
                onTogglePin={() => {
                  void updatePrompt(p.id, { pinned: !p.pinned }).then(reload);
                }}
              />
            ))
          )}
        </div>

        <div className="footer">
          <span className="status-dot" />
          <span>Local vault · {vault.prompts.length} prompts</span>
          <span className="spacer" />
        </div>
      </main>

      {editing && (
        <PromptEditor
          prompt={editing === "new" ? null : editing}
          folders={vault.folders}
          onSave={(input, existing) => void handleSave(input, existing)}
          onDelete={(id) => void handleDelete(id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
