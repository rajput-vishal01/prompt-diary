import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, MoreHorizontal, Plus, RefreshCw, X } from "lucide-react";
import type { Folder, Prompt } from "shared";
import {
  buildHandoffText,
  getHandoff,
  setHandoff,
  siteName,
  type Handoff,
} from "../lib/handoff";
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
  createProject,
  createThread,
  getActiveThread,
  getAuth,
  getTeams,
  getThreads,
  setActiveThread,
  signOut,
  tryCookieSession,
  type AuthState,
  type TeamRow,
  type ThreadRef,
} from "../lib/api";
import { syncNow } from "../lib/sync";

type Filter = "all" | "pinned" | { folderId: string };

// Runs INSIDE the page via chrome.scripting — must be fully self-contained
// (it is serialized, so no imports or closures). The element that was focused
// when the popup opened is still document.activeElement.
function insertIntoFocusedField(text: string): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.readOnly || el.disabled) return false;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const proto =
      el instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;
    // native setter so React/Vue-controlled inputs see the change
    const setValue = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setValue?.call(el, el.value.slice(0, start) + text + el.value.slice(end));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    return true;
  }
  if (el.isContentEditable) {
    el.focus();
    document.execCommand("insertText", false, text);
    return true;
  }
  return false;
}

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
  const [recording, setRecording] = useState<ThreadRef | null>(null);
  const [recPicker, setRecPicker] = useState<ThreadRef[] | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  // navigation tree lives behind "⋯" as a temporary overlay, never a column
  const [manageOpen, setManageOpen] = useState(false);
  // context transfer: one handoff slot + whether this tab can be captured
  const [handoff, setHandoffState] = useState<Handoff | null>(null);
  const [canCapture, setCanCapture] = useState(false);
  // window.prompt is unreliable in MV3 popups — inline ask overlay instead
  const [ask, setAsk] = useState<{
    title: string;
    placeholder: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [askValue, setAskValue] = useState("");
  const [confirmAsk, setConfirmAsk] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const reload = () => void getVault().then(setVaultState);

  // launcher behavior: typing ANYWHERE in the popup lands in the search box —
  // clicking a chip/row steals focus, and search must never "stop working"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typingTarget =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      if (typingTarget) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchRef.current?.focus(); // this keystroke then lands in the input
      } else if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    reload();
    void getRecents().then(setRecents);
    void getActiveThread().then(setRecording);
    void getHandoff().then(setHandoffState);
    // the Transfer chip only appears on sites we can actually capture
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        const host = tab?.url ? new URL(tab.url).hostname : "";
        setCanCapture(/chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com/.test(host));
      })
      .catch(() => {});
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

  // the arrow-key cursor must stay on screen — it IS the core interaction
  useEffect(() => {
    listRef.current
      ?.querySelector(".row.selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, prompts]);

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
    searchRef.current?.focus(); // keep the keyboard loop alive after a click
  };

  // the insert cascade, shared by prompt-insert and context-handoff insert:
  // content script composer → activeTab scripting → false (caller falls back)
  const insertText = async (body: string): Promise<boolean> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (!tab?.id) return false;
    // 1) AI chat sites: the content script knows the site's composer
    try {
      const res = (await chrome.tabs.sendMessage(tab.id, {
        type: "insert-prompt",
        body,
      })) as { ok?: boolean };
      if (res?.ok) return true;
    } catch {
      // no content script on this tab — try scripting below
    }
    // 2) any other site: activeTab grants one-shot access, inject into the
    //    field that was focused when the popup opened
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: insertIntoFocusedField,
        args: [body],
      });
      if (result?.result) return true;
    } catch {
      // restricted page (chrome://, web store) — fall through
    }
    return false;
  };

  // Enter: insert straight into the active tab's chatbox; copy if there isn't one
  const insertOrCopy = async (prompt: Prompt) => {
    if (await insertText(prompt.body)) {
      await bumpUseCount(prompt.id);
      await pushRecent(prompt.id);
      window.close();
      return;
    }
    // nowhere to type: copy to clipboard
    await handleCopy(prompt);
    window.close();
  };

  // ---------- context transfer ----------

  const captureContext = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (!tab?.id) return;
    try {
      const res = (await chrome.tabs.sendMessage(tab.id, { type: "capture-transcript" })) as
        | { ok: true; handoff: Handoff }
        | { ok: false; reason: string };
      if (res.ok) {
        await setHandoff(res.handoff);
        setHandoffState(res.handoff);
        setSyncMsg(`Context captured ✓ — open another AI chat and hit Insert`);
      } else {
        setSyncMsg(res.reason === "empty" ? "Nothing to capture here" : "Can't capture on this site yet");
      }
    } catch {
      setSyncMsg("Reload the chat tab first, then try again");
    }
    setTimeout(() => setSyncMsg(null), 3000);
  };

  const insertHandoff = async () => {
    if (!handoff) return;
    const text = buildHandoffText(handoff);
    if (await insertText(text)) {
      await setHandoff(null); // one-shot by design
      window.close();
      return;
    }
    await navigator.clipboard.writeText(text);
    setSyncMsg("Copied — paste into the chat");
    setTimeout(() => setSyncMsg(null), 2500);
  };

  const handleSync = async () => {
    setSyncMsg("Syncing…");
    const result = await syncNow();
    setSyncMsg(result.synced ? "Synced ✓" : (result.error ?? "Sync failed"));
    reload();
    setTimeout(() => setSyncMsg(null), 2500);
  };

  const handleNewFolder = () => {
    setAskValue("");
    setAsk({
      title: "New folder",
      placeholder: "Folder name",
      onSubmit: (name) => void addFolder(name).then(reload),
    });
  };

  const handleDeleteFolder = async (folder: Folder) => {
    setConfirmAsk({
      title: `Delete folder “${folder.name}”?`,
      body: "Prompts inside are kept.",
      onConfirm: () => {
        void deleteFolder(folder.id).then(() => {
          if (filter !== "all" && filter !== "pinned" && filter.folderId === folder.id) {
            setFilter("all");
          }
          reload();
        });
      },
    });
  };

  const isFolderActive = (id: string) =>
    filter !== "all" && filter !== "pinned" && filter.folderId === id;

  return (
    <div className="app" style={{ position: "relative" }}>
      {/* ---------- header: wordmark → search → filter chips ---------- */}
      <div className="header">
        <div className="brand-row">
          <span className="brand">PromptDiary</span>
          <button className="btn primary small" onClick={() => setEditing("new")}>
            <Plus size={13} /> New
          </button>
        </div>

        <div className="search-wrap">
          <input
            ref={searchRef}
            className="search"
            placeholder="Search prompts…"
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
          {/* persistent hint — arrow nav stays active while typing */}
          <span className="kbd-hint" aria-hidden>
            ↑↓ ↵
          </span>
        </div>

        {/* navigation = one 28px chip row, not a permanent column */}
        <div className="chips">
          <button
            className={`chip ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`chip ${filter === "pinned" ? "active" : ""}`}
            onClick={() => setFilter("pinned")}
          >
            ★ Pinned
          </button>
          {vault.folders.map((f) => (
            <button
              key={f.id}
              className={`chip ${isFolderActive(f.id) ? "active" : ""}`}
              onClick={() => setFilter(isFolderActive(f.id) ? "all" : { folderId: f.id })}
            >
              <span className="dot" style={{ background: f.color }} />
              {f.name}
            </button>
          ))}
          {canCapture && (
            <button
              className="chip"
              title="Capture this conversation's context to continue it on another AI"
              onClick={() => void captureContext()}
            >
              <ArrowLeftRight size={12} /> Transfer
            </button>
          )}
          {recording && (
            <button
              className="chip recording"
              title={`Recording to “${recording.title}” — click to stop`}
              onClick={() => void setActiveThread(null).then(() => setRecording(null))}
            >
              ◉ {recording.title}
            </button>
          )}
          <button
            className="chip manage"
            title="Folders & threads"
            onClick={() => setManageOpen(true)}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* ---------- context handoff: continue a captured conversation here ---------- */}
      {handoff && (
        <div className="handoff-banner">
          <ArrowLeftRight size={13} className="handoff-icon" />
          <span className="handoff-text">
            Continue <b>“{handoff.title}”</b>
            <span className="handoff-meta">
              {siteName(handoff.site)} · {handoff.messages.length} messages
              {handoff.truncated ? " · truncated" : ""}
            </span>
          </span>
          <button className="btn primary small" onClick={() => void insertHandoff()}>
            Insert
          </button>
          <button
            className="icon-btn"
            title="Discard captured context"
            onClick={() => {
              void setHandoff(null);
              setHandoffState(null);
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ---------- results ---------- */}
      <div className="list" ref={listRef}>
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
              onCopy={() => void handleCopy(p)}
              onEdit={() => setEditing(p)}
              onTogglePin={() => {
                void updatePrompt(p.id, { pinned: !p.pinned }).then(reload);
              }}
            />
          ))
        )}
      </div>

      {/* ---------- footer: left group / right group ---------- */}
      <div className="footer">
        <div className="footer-left">
          <span className={`status-dot ${auth ? "online" : ""}`} />
          <span>
            {syncMsg ??
              (auth
                ? `${auth.email} · ${vault.prompts.length} prompts`
                : `Local vault · ${vault.prompts.length} prompts`)}
          </span>
        </div>
        <div className="footer-right">
          <button
            className="kbd-badge"
            title="Change the keyboard shortcut (opens Chrome's shortcut settings)"
            onClick={() => {
              void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
            }}
          >
            {hotkey}
          </button>
          {auth ? (
            <>
              <button className="icon-btn" title="Sync now" onClick={() => void handleSync()}>
                <RefreshCw size={13} />
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
      </div>

      {/* ---------- "⋯" management overlay: the tree, temporarily ---------- */}
      {manageOpen && (
        <div className="editor">
          <h2>Folders & threads</h2>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div className="manage-section">Folders</div>
            {vault.folders.map((f) => (
              <button
                key={f.id}
                className="manage-item"
                onClick={() => {
                  setFilter({ folderId: f.id });
                  setManageOpen(false);
                }}
              >
                <span className="dot" style={{ background: f.color }} />
                <span className="label">{f.name}</span>
                <span
                  className="x"
                  title="Delete folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    setManageOpen(false);
                    void handleDeleteFolder(f);
                  }}
                >
                  ×
                </span>
              </button>
            ))}
            <button
              className="manage-item muted"
              onClick={() => {
                setManageOpen(false);
                handleNewFolder();
              }}
            >
              + New folder
            </button>

            {auth && (
              <>
                <div className="manage-section">Threads</div>
                <button
                  className="manage-item"
                  style={recording ? { color: "var(--danger)", fontWeight: 600 } : undefined}
                  title={
                    recording
                      ? `Recording to “${recording.title}” — click to stop`
                      : "Record saves into a thread"
                  }
                  onClick={() => {
                    if (recording) {
                      void setActiveThread(null).then(() => setRecording(null));
                    } else {
                      setManageOpen(false);
                      void getThreads().then(setRecPicker).catch(() => setRecPicker([]));
                    }
                  }}
                >
                  <span className="label">
                    {recording ? `◉ Recording — ${recording.title}` : "○ Record to thread"}
                  </span>
                </button>
                <button
                  className="manage-item muted"
                  onClick={() => {
                    setManageOpen(false);
                    setAskValue("");
                    setAsk({
                      title: "New thread",
                      placeholder: "Thread title",
                      onSubmit: (title) =>
                        void createThread(title).then((t) => {
                          void setActiveThread(t);
                          setRecording(t);
                          setSyncMsg(`Recording → ${t.title}`);
                          setTimeout(() => setSyncMsg(null), 2000);
                        }),
                    });
                  }}
                >
                  + New thread
                </button>
                <button
                  className="manage-item muted"
                  onClick={() => {
                    setManageOpen(false);
                    setAskValue("");
                    setAsk({
                      title: "New project",
                      placeholder: "Project name",
                      onSubmit: (name) =>
                        void createProject(name).then(() => {
                          setSyncMsg("Project created");
                          setTimeout(() => setSyncMsg(null), 2000);
                        }),
                    });
                  }}
                >
                  + New project
                </button>
              </>
            )}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setManageOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {ask && (
        <div className="editor">
          <h2>{ask.title}</h2>
          <input
            placeholder={ask.placeholder}
            value={askValue}
            autoFocus
            onChange={(e) => setAskValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && askValue.trim()) {
                ask.onSubmit(askValue.trim());
                setAsk(null);
              }
              if (e.key === "Escape") setAsk(null);
            }}
          />
          <div style={{ flex: 1 }} />
          <div className="actions">
            <button className="btn" onClick={() => setAsk(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!askValue.trim()}
              onClick={() => {
                ask.onSubmit(askValue.trim());
                setAsk(null);
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {confirmAsk && (
        <div className="editor">
          <h2>{confirmAsk.title}</h2>
          <p style={{ color: "var(--dim)", fontSize: 12, lineHeight: 1.5 }}>
            {confirmAsk.body}
          </p>
          <div style={{ flex: 1 }} />
          <div className="actions">
            <button className="btn" onClick={() => setConfirmAsk(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={() => {
                confirmAsk.onConfirm();
                setConfirmAsk(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {recPicker !== null && (
        <div className="editor">
          <h2>Record to thread</h2>
          <p style={{ color: "var(--dim)", fontSize: 12, lineHeight: 1.5 }}>
            While recording, every save becomes the next step of the thread.
          </p>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {recPicker.map((t) => (
              <button
                key={t.id}
                className="manage-item"
                style={{ marginBottom: 2 }}
                onClick={() => {
                  void setActiveThread(t).then(() => {
                    setRecording(t);
                    setRecPicker(null);
                  });
                }}
              >
                <span className="label">{t.title}</span>
              </button>
            ))}
            {recPicker.length === 0 && (
              <p style={{ color: "var(--dim)", fontSize: 12 }}>No threads yet.</p>
            )}
          </div>
          <input
            placeholder="New thread title…"
            value={newThreadTitle}
            onChange={(e) => setNewThreadTitle(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="actions">
            <button className="btn" onClick={() => setRecPicker(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!newThreadTitle.trim()}
              onClick={() => {
                void createThread(newThreadTitle.trim()).then((t) => {
                  void setActiveThread(t);
                  setRecording(t);
                  setRecPicker(null);
                  setNewThreadTitle("");
                });
              }}
            >
              Create & record
            </button>
          </div>
        </div>
      )}

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
          onDelete={(id) =>
            setConfirmAsk({
              title: "Delete this prompt?",
              body: "This removes it from your vault (and syncs the deletion).",
              onConfirm: () => void handleDelete(id),
            })
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
