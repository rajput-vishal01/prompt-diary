import { useEffect, useMemo, useState } from "react";
import type { Folder, Prompt } from "shared";
import {
  addFolder,
  addPrompt,
  bumpUseCount,
  getRecents,
  pushRecent,
  deleteFolder,
  deletePrompt,
  getVault,
  updatePrompt,
  type NewPrompt,
  type Vault,
} from "../lib/vault";
import { PromptCard } from "./PromptCard";
import { PromptEditor } from "./PromptEditor";
import { AccountView } from "./AccountView";
import {
  getAuth,
  getTeams,
  signOut,
  tryCookieSession,
  type AuthState,
  type TeamRow,
} from "../lib/api";
import { syncNow } from "../lib/sync";

type Filter = "all" | "pinned" | { folderId: string };

export function App() {
  const [vault, setVaultState] = useState<Vault | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Prompt | "new" | null>(null);
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [showAccount, setShowAccount] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [hotkey, setHotkey] = useState<string>("");

  const reload = () => void getVault().then(setVaultState);

  useEffect(() => {
    reload();
    void getRecents().then(setRecents);
    // show the ACTUAL current binding (users can rebind it in chrome)
    chrome.commands.getAll((cmds) => {
      const open = cmds.find((c) => c.name === "_execute_action");
      setHotkey(open?.shortcut || "not set");
    });
    // auto-sync on popup open so prompts added on the web (dashboard,
    // gallery "add to my diary") show up without a manual Sync click
    void getAuth().then(async (a) => {
      // no stored auth? adopt an existing web session (google users)
      const auth = a ?? (await tryCookieSession());
      setAuthState(auth);
      if (auth) {
        void syncNow().then(reload);
        void getTeams().then(setTeams).catch(() => {});
      }
    });
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
      // recently used first — the same few prompts get reused constantly
      const ra = recents.indexOf(a.id);
      const rb = recents.indexOf(b.id);
      if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [vault, filter, query, recents]);

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
    await pushRecent(prompt.id);
    reload();
  };

  // Enter: insert straight into the active tab's chatbox; copy if there isn't one
  const insertOrCopy = async (prompt: Prompt) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const res = (await chrome.tabs.sendMessage(tab.id, {
          type: "insert-prompt",
          body: prompt.body,
        })) as { ok?: boolean };
        if (res?.ok) {
          await bumpUseCount(prompt.id);
          await pushRecent(prompt.id);
          window.close();
          return;
        }
      }
    } catch {
      // no content script on this tab — fall through to copy
    }
    await handleCopy(prompt);
    window.close();
  };

  const handleSync = async () => {
    setSyncMsg("Syncing…");
    const result = await syncNow();
    setSyncMsg(result.synced ? "Synced ✓" : (result.error ?? "Sync failed"));
    reload();
    setTimeout(() => setSyncMsg(null), 2500);
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
            placeholder="Search — ↑↓ then ↵ inserts into chat"
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, prompts.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const p = prompts[selected];
                if (p) void insertOrCopy(p);
              } else if (e.key === "Escape" && query) {
                setQuery("");
              }
            }}
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
            prompts.map((p, i) => (
              <PromptCard
                key={p.id}
                isSelected={i === selected}
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
          <span className={`status-dot ${auth ? "online" : ""}`} />
          <span>
            {syncMsg ??
              (auth
                ? `${auth.email} · ${vault.prompts.length} prompts`
                : `Local vault · ${vault.prompts.length} prompts`)}
          </span>
          <span className="spacer" />
          <button
            className="link-btn"
            title="Change the keyboard shortcut (opens Chrome's shortcut settings)"
            onClick={() => {
              void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
            }}
          >
            ⌨ {hotkey}
          </button>
          {auth ? (
            <>
              <button className="link-btn" onClick={() => void handleSync()}>
                Sync
              </button>
              <button
                className="link-btn"
                onClick={() => {
                  void signOut().then(() => {
                    setAuthState(null);
                    setTeams([]); // stale team list must not linger in the editor
                  });
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button className="link-btn" onClick={() => setShowAccount(true)}>
              Sign in to sync
            </button>
          )}
        </div>
      </main>

      {showAccount && (
        <AccountView
          onDone={(a) => {
            setAuthState(a);
            setShowAccount(false);
            void handleSync();
          }}
          onClose={() => setShowAccount(false)}
        />
      )}

      {editing && (
        <PromptEditor
          prompt={editing === "new" ? null : editing}
          folders={vault.folders}
          teams={teams}
          onSave={(input, existing) => void handleSave(input, existing)}
          onDelete={(id) => void handleDelete(id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
