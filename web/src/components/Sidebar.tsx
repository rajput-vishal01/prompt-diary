"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Reorder } from "framer-motion";
import type { Folder } from "shared";
import { api } from "@/lib/client-api";
import { signOut, useSession } from "@/lib/auth-client";
import { dialog } from "@/components/Dialog";

interface ProjectRow {
  id: string;
  name: string;
  color: string;
}

interface TeamRow {
  id: string;
  name: string;
  role: "owner" | "member";
}

// dashboard listens for this to refetch after sidebar mutations
export const FOLDERS_CHANGED_EVENT = "pd-folders-changed";
const emitFoldersChanged = () =>
  window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));

// which sections are expanded — Notion remembers, so do we
const OPEN_KEY = "pd-sb-open";
type OpenState = { prompts: boolean; projects: boolean; teams: boolean };
const DEFAULT_OPEN: OpenState = { prompts: true, projects: true, teams: true };

function loadOpen(): OpenState {
  try {
    return { ...DEFAULT_OPEN, ...JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") };
  } catch {
    return DEFAULT_OPEN;
  }
}

// ---------- tiny building blocks ----------

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 text-dim transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

// hover ⋯ menu, Notion-style: appears on row hover, opens a small popover
function RowMenu({
  onRename,
  onDelete,
}: {
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative ml-auto shrink-0">
      <button
        aria-label="More actions"
        className={`rounded-md px-1.5 py-0.5 text-dim opacity-0 transition-opacity hover:bg-line group-hover:opacity-100 ${open ? "bg-line opacity-100" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        ⋯
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <span className="absolute right-0 top-7 z-50 flex w-36 flex-col overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-soft">
            <button
              className="px-3 py-1.5 text-left text-sm text-ink hover:bg-hover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onRename();
              }}
            >
              Rename
            </button>
            <button
              className="px-3 py-1.5 text-left text-sm text-danger hover:bg-hover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          </span>
        </>
      )}
    </span>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<OpenState>(DEFAULT_OPEN);
  // ignore row clicks that were actually the tail end of a drag
  const draggingRef = useRef(false);

  useEffect(() => setOpen(loadOpen()), []);
  const toggle = (key: keyof OpenState) =>
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      return next;
    });

  const reloadFolders = useCallback(
    () => api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {}),
    [],
  );
  const reloadProjects = useCallback(
    () => api<ProjectRow[]>("/api/v1/projects").then(setProjects).catch(() => {}),
    [],
  );
  const reloadTeams = useCallback(
    () => api<TeamRow[]>("/api/v1/teams").then(setTeams).catch(() => {}),
    [],
  );

  useEffect(() => {
    if (session) {
      void reloadFolders();
      void reloadProjects();
      void reloadTeams();
    }
  }, [session, reloadFolders, reloadProjects, reloadTeams]);

  // other pages mutate folders/projects/teams too — stay in sync
  useEffect(() => {
    const onChanged = () => {
      void reloadFolders();
      void reloadProjects();
      void reloadTeams();
    };
    window.addEventListener(FOLDERS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, onChanged);
  }, [reloadFolders, reloadProjects, reloadTeams]);

  if (!session) return null;

  const onPrompts = pathname === "/dashboard";
  const activeFolder = onPrompts ? searchParams.get("folder") : null;
  const activeTab = onPrompts ? searchParams.get("tab") : null;
  const activeProject =
    pathname === "/dashboard/projects" ? searchParams.get("p") : null;
  const activeTeam =
    pathname === "/dashboard/teams" ? searchParams.get("t") : null;

  // ---------- folder actions ----------

  const newFolder = async () => {
    const name = await dialog.prompt({ title: "New folder", placeholder: "Folder name", submitLabel: "Create" });
    if (!name?.trim()) return;
    const folder = await api<Folder>("/api/v1/folders", {
      method: "POST",
      body: { name: name.trim() },
    });
    await reloadFolders();
    emitFoldersChanged();
    router.push(`/dashboard?folder=${folder.id}`);
  };

  const renameFolder = async (f: Folder) => {
    const name = await dialog.prompt({ title: "Rename folder", initial: f.name });
    if (!name?.trim() || name.trim() === f.name) return;
    await api(`/api/v1/folders/${f.id}`, { method: "PATCH", body: { name: name.trim() } });
    await reloadFolders();
    emitFoldersChanged();
  };

  const deleteFolder = async (f: Folder) => {
    if (!(await dialog.confirm({ title: `Delete folder “${f.name}”?`, body: "Prompts inside are kept.", danger: true }))) return;
    await api(`/api/v1/folders/${f.id}`, { method: "DELETE" });
    await reloadFolders();
    emitFoldersChanged();
    if (activeFolder === f.id) router.push("/dashboard");
  };

  // persist a drag-reorder: each row's new index becomes its sortOrder
  const persistOrder = (kind: "folders" | "projects", ids: string[]) => {
    for (let i = 0; i < ids.length; i++) {
      void api(`/api/v1/${kind}/${ids[i]}`, { method: "PATCH", body: { sortOrder: i } }).catch(() => {});
    }
  };

  // ---------- project actions ----------

  const newProject = async () => {
    const name = await dialog.prompt({ title: "New project", placeholder: "Project name", submitLabel: "Create" });
    if (!name?.trim()) return;
    await api("/api/v1/projects", { method: "POST", body: { name: name.trim() } });
    await reloadProjects();
    emitFoldersChanged();
  };

  const renameProject = async (p: ProjectRow) => {
    const name = await dialog.prompt({ title: "Rename project", initial: p.name });
    if (!name?.trim() || name.trim() === p.name) return;
    await api(`/api/v1/projects/${p.id}`, { method: "PATCH", body: { name: name.trim() } });
    await reloadProjects();
    emitFoldersChanged();
  };

  const deleteProject = async (p: ProjectRow) => {
    if (!(await dialog.confirm({ title: `Delete project “${p.name}”?`, body: "Its threads are kept.", danger: true }))) return;
    await api(`/api/v1/projects/${p.id}`, { method: "DELETE" });
    await reloadProjects();
    emitFoldersChanged();
    if (activeProject === p.id) router.push("/dashboard/projects");
  };

  // ---------- team actions ----------

  const newTeam = async () => {
    const name = await dialog.prompt({ title: "New team", placeholder: "Team name", submitLabel: "Create" });
    if (!name?.trim()) return;
    try {
      const t = await api<TeamRow>("/api/v1/teams", { method: "POST", body: { name: name.trim() } });
      await reloadTeams();
      router.push(`/dashboard/teams?t=${t.id}`);
    } catch (e) {
      await dialog.confirm({
        title: "Could not create team",
        body: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  };

  // ---------- styles ----------

  const rowCls = (active: boolean) =>
    `group flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[15px] transition-colors ${
      active ? "bg-tint font-medium text-ink" : "text-dim hover:bg-hover hover:text-ink"
    }`;

  const sectionCls = (active: boolean) =>
    `group flex flex-1 items-center gap-1.5 rounded-lg px-2 py-2 text-[15px] font-medium transition-colors ${
      active ? "bg-tint text-ink" : "text-ink hover:bg-hover"
    }`;

  const rowClick = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (draggingRef.current) return; // drag release, not a click
    router.push(href);
  };

  return (
    <>
      {/* mobile: hamburger + backdrop drawer */}
      <button
        className="btn fixed left-3 top-3 z-50 md:hidden"
        aria-label="Menu"
        onClick={() => setMobileOpen((o) => !o)}
      >
        ☰
      </button>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`${
          mobileOpen ? "fixed inset-y-0 left-0 z-40 flex w-80" : "hidden"
        } shrink-0 flex-col border-r border-line bg-raised p-4 md:static md:flex md:w-[35%] md:min-w-[300px]`}
        onClick={() => setMobileOpen(false)}
      >
        <Link href="/" className="mb-6 px-2 font-display text-[22px] font-light tracking-tight">
          Prompt Diary
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
          {/* ---------- My Prompts ---------- */}
          <div className="flex items-center">
            <button className="rounded-md p-1 hover:bg-hover" aria-label="Toggle prompts" onClick={() => toggle("prompts")}>
              <Chevron open={open.prompts} />
            </button>
            <Link
              href="/dashboard"
              className={sectionCls(onPrompts && !activeFolder && !activeTab)}
            >
              My Prompts
            </Link>
          </div>
          {open.prompts && (
            <div className="mb-2 ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
              <Link href="/dashboard?tab=pinned" className={rowCls(activeTab === "pinned")}>
                <span className="text-sm">★</span> Pinned
              </Link>
              <Reorder.Group
                axis="y"
                values={folders.map((f) => f.id)}
                onReorder={(ids: string[]) => {
                  const byId = new Map(folders.map((f) => [f.id, f]));
                  setFolders(ids.map((id) => byId.get(id)!).filter(Boolean));
                }}
                className="flex flex-col gap-0.5"
              >
                {folders.map((f) => (
                  <Reorder.Item
                    key={f.id}
                    value={f.id}
                    onDragStart={() => (draggingRef.current = true)}
                    onDragEnd={() => {
                      setTimeout(() => (draggingRef.current = false), 50);
                      persistOrder("folders", folders.map((x) => x.id));
                    }}
                    whileDrag={{ scale: 1.02, backgroundColor: "#ffffff", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", borderRadius: 8 }}
                  >
                    <a
                      href={`/dashboard?folder=${f.id}`}
                      className={`${rowCls(activeFolder === f.id)} cursor-grab active:cursor-grabbing`}
                      onClick={rowClick(`/dashboard?folder=${f.id}`)}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: f.color }} />
                      <span className="truncate">{f.name}</span>
                      <RowMenu onRename={() => void renameFolder(f)} onDelete={() => void deleteFolder(f)} />
                    </a>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
              <button className={`${rowCls(false)} text-dim`} onClick={() => void newFolder()}>
                <span className="text-sm">+</span> New folder
              </button>
            </div>
          )}

          {/* ---------- Projects ---------- */}
          <div className="flex items-center">
            <button className="rounded-md p-1 hover:bg-hover" aria-label="Toggle projects" onClick={() => toggle("projects")}>
              <Chevron open={open.projects} />
            </button>
            <Link
              href="/dashboard/projects"
              className={sectionCls(pathname === "/dashboard/projects" && !activeProject)}
            >
              Projects
            </Link>
          </div>
          {open.projects && (
            <div className="mb-2 ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
              <Reorder.Group
                axis="y"
                values={projects.map((p) => p.id)}
                onReorder={(ids: string[]) => {
                  const byId = new Map(projects.map((p) => [p.id, p]));
                  setProjects(ids.map((id) => byId.get(id)!).filter(Boolean));
                }}
                className="flex flex-col gap-0.5"
              >
                {projects.map((p) => (
                  <Reorder.Item
                    key={p.id}
                    value={p.id}
                    onDragStart={() => (draggingRef.current = true)}
                    onDragEnd={() => {
                      setTimeout(() => (draggingRef.current = false), 50);
                      persistOrder("projects", projects.map((x) => x.id));
                    }}
                    whileDrag={{ scale: 1.02, backgroundColor: "#ffffff", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", borderRadius: 8 }}
                  >
                    <a
                      href={`/dashboard/projects?p=${p.id}`}
                      className={`${rowCls(activeProject === p.id)} cursor-grab active:cursor-grabbing`}
                      onClick={rowClick(`/dashboard/projects?p=${p.id}`)}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                      <RowMenu onRename={() => void renameProject(p)} onDelete={() => void deleteProject(p)} />
                    </a>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
              <button className={`${rowCls(false)} text-dim`} onClick={() => void newProject()}>
                <span className="text-sm">+</span> New project
              </button>
            </div>
          )}

          {/* ---------- Teams (your memberships, role inline) ---------- */}
          <div className="flex items-center">
            <button className="rounded-md p-1 hover:bg-hover" aria-label="Toggle teams" onClick={() => toggle("teams")}>
              <Chevron open={open.teams} />
            </button>
            <Link
              href="/dashboard/teams"
              className={sectionCls(pathname === "/dashboard/teams" && !activeTeam)}
            >
              Teams
            </Link>
          </div>
          {open.teams && (
            <div className="mb-2 ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/teams?t=${t.id}`}
                  className={rowCls(activeTeam === t.id)}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-tint text-xs font-semibold">
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{t.name}</span>
                  <span className={`ml-auto shrink-0 text-xs ${t.role === "owner" ? "text-amber" : "text-dim"}`}>
                    {t.role}
                  </span>
                </Link>
              ))}
              {teams.length === 0 && (
                <span className="px-3 py-1 text-sm text-dim">No teams yet</span>
              )}
              <button className={`${rowCls(false)} text-dim`} onClick={() => void newTeam()}>
                <span className="text-sm">+</span> New team
              </button>
            </div>
          )}

          {/* ---------- flat items ---------- */}
          {[
            { href: "/dashboard/usage", label: "Usage" },
            { href: "/gallery", label: "Public Gallery" },
            { href: "/dashboard/profile", label: "Profile" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-[15px] ${
                pathname === item.href
                  ? "bg-tint font-medium text-ink"
                  : "text-dim hover:bg-hover hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-line px-1 pt-3">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-ink">
              {(session.user.name || session.user.email).charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {session.user.name}
            </span>
            <span className="block truncate text-xs text-dim">
              {session.user.email}
            </span>
          </span>
          <button
            className="text-xs font-semibold text-dim hover:text-danger"
            title="Sign out"
            onClick={() => void signOut().then(() => router.push("/"))}
          >
            Exit
          </button>
        </div>
      </aside>
    </>
  );
}
