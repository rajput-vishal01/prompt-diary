"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Folder as FolderIcon, FolderKanban, Star, Users } from "lucide-react";
import type { Folder, Prompt } from "shared";
import { FACETS, promptFacets } from "shared";
import { api } from "@/lib/client-api";
import { signOut, useSession } from "@/lib/auth-client";
import { toast } from "@/components/Toast";
import { TreeSection, type TreeNode } from "@/components/TreeSection";

interface ProjectRow {
  id: string;
  name: string;
  color: string;
  teamId: string | null;
  threadCount: number;
}

interface ThreadRow {
  id: string;
  title: string;
  projectId: string | null;
  stepCount: number;
}

interface TeamRow {
  id: string;
  name: string;
  role: "owner" | "member";
}

// dashboard pages listen for this to refetch after sidebar mutations
export const FOLDERS_CHANGED_EVENT = "pd-folders-changed";
const emitChanged = () => window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));

// sidebar rail: fixed default, drag-resizable on the right edge
const WIDTH_KEY = "pd-sb-width";
const WIDTH_DEFAULT = 288;
const WIDTH_MIN = 240;
const WIDTH_MAX = 420;

export function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [width, setWidth] = useState(WIDTH_DEFAULT);
  const resizing = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (saved >= WIDTH_MIN && saved <= WIDTH_MAX) setWidth(saved);
  }, []);

  const reload = useCallback(() => {
    void api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});
    void api<ProjectRow[]>("/api/v1/projects").then(setProjects).catch(() => {});
    void api<ThreadRow[]>("/api/v1/threads").then(setThreads).catch(() => {});
    void api<TeamRow[]>("/api/v1/teams").then(setTeams).catch(() => {});
    void api<Prompt[]>("/api/v1/prompts").then(setPrompts).catch(() => {});
  }, []);

  useEffect(() => {
    if (session) reload();
  }, [session, reload]);

  useEffect(() => {
    const onChanged = () => reload();
    window.addEventListener(FOLDERS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, onChanged);
  }, [reload]);

  // right-edge drag resize
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    const move = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const w = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, ev.clientX));
      setWidth(w);
    };
    const up = () => {
      resizing.current = false;
      setWidth((w) => {
        localStorage.setItem(WIDTH_KEY, String(w));
        return w;
      });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!session) return null;

  const onPrompts = pathname === "/dashboard";
  const activeFolder = onPrompts ? searchParams.get("folder") : null;
  const activeTab = onPrompts ? searchParams.get("tab") : null;
  const activeProject = pathname === "/dashboard/projects" ? searchParams.get("p") : null;
  const activeThread = pathname.startsWith("/dashboard/t/") ? pathname.split("/").pop() : null;
  const activeTeam = pathname === "/dashboard/teams" ? searchParams.get("t") : null;

  const navigate = (href: string) => router.push(href);

  // ---------- My Prompts: Pinned pseudo-folder (fixed) + folders ----------

  const promptNodes: TreeNode[] = [
    {
      id: "pinned",
      label: "Pinned",
      icon: <Star className={activeTab === "pinned" ? "fill-brass text-brass" : ""} />,
      href: "/dashboard?tab=pinned",
      fixed: true,
    },
    ...folders.map((f) => ({
      id: f.id,
      label: f.name,
      icon: <FolderIcon style={{ color: f.color }} />,
      href: `/dashboard?folder=${f.id}`,
      canRename: true,
      canDelete: true,
      canDrag: true,
      onAdd: () => router.push(`/dashboard/new?folder=${f.id}`),
    })),
  ];

  // ---------- Projects: threads nested one level deep ----------

  const threadLeaf = (t: ThreadRow): TreeNode => ({
    id: t.id,
    label: t.title,
    icon: <FileText />,
    href: `/dashboard/t/${t.id}`,
    // looping badge only when active — no empty badges
    badge: t.stepCount >= 3 ? <span className="chip">looping</span> : undefined,
    canRename: true,
    canDelete: true,
    canDrag: true, // draggable INTO another project
  });

  const projectNodes: TreeNode[] = projects.map((p) => ({
    id: p.id,
    label: p.name,
    icon: <FolderKanban style={{ color: p.color }} />,
    href: `/dashboard/projects?p=${p.id}`,
    badge: p.threadCount > 0 ? String(p.threadCount) : undefined,
    children: threads.filter((t) => t.projectId === p.id).map(threadLeaf),
    childCount: p.threadCount,
    canRename: true,
    canDelete: true,
    canDrag: true,
    acceptsDrop: true, // drop a thread onto a project to move it
    onAddChild: async (name: string) => {
      await api("/api/v1/threads", { method: "POST", body: { title: name, projectId: p.id } });
      emitChanged();
    },
  }));

  // ---------- Teams: membership visible inline, team projects nested ----------

  const teamNodes: TreeNode[] = teams.map((t) => ({
    id: t.id,
    label: t.name,
    icon: <Users />,
    href: `/dashboard/teams?t=${t.id}`,
    // "you're in this team" is never hidden behind a click
    badge: (
      <span className="font-medium capitalize text-brass">{t.role}</span>
    ),
    children: projects
      .filter((p) => p.teamId === t.id)
      .map((p) => ({
        id: `team-${p.id}`,
        label: p.name,
        icon: <FolderKanban style={{ color: p.color }} />,
        href: `/dashboard/projects?p=${p.id}`,
      })),
  }));

  // ---------- Tags: derived from prompt data, not user-managed ----------

  const activeTag = onPrompts ? searchParams.get("tag") : null;

  // stable desaturated dot color per tag name
  const tagColor = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${h} 30% 52%)`;
  };

  const facetCounts = new Map<string, number>(FACETS.map((f) => [f, 0]));
  const tagCounts = new Map<string, number>();
  for (const p of prompts) {
    for (const f of promptFacets(p.body)) facetCounts.set(f, (facetCounts.get(f) ?? 0) + 1);
    for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const usedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const tagNode = (name: string, count: number): TreeNode => {
    const isActive = activeTag === name;
    return {
      id: `tag:${name}`,
      label: name,
      icon: <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor(name) }} />,
      // clicking an already-active tag clears the filter — toggle, not select
      href: isActive ? "/dashboard" : `/dashboard?tag=${encodeURIComponent(name)}`,
      badge: count > 0 ? String(count) : undefined,
    };
  };

  const tagNodes: TreeNode[] = [
    ...FACETS.map((f) => tagNode(f, facetCounts.get(f) ?? 0)),
    ...usedTags.filter(([t]) => !(FACETS as readonly string[]).includes(t)).map(([t, c]) => tagNode(t, c)),
  ];

  // ---------- mutations ----------

  // every mutation toasts on failure — a rename/delete/move that silently
  // rejected would otherwise leave the tree looking unchanged with no signal
  const errMsg = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  const renameItem = (kind: "folders" | "projects" | "threads") =>
    async (node: TreeNode, name: string) => {
      const id = node.id;
      const body = kind === "threads" ? { title: name } : { name };
      try {
        await api(`/api/v1/${kind}/${id}`, { method: "PATCH", body });
        emitChanged();
      } catch (e) {
        toast(errMsg(e, "Rename failed"), { kind: "error" });
      }
    };

  const deleteFolderNode = async (node: TreeNode) => {
    const f = folders.find((x) => x.id === node.id);
    try {
      await api(`/api/v1/folders/${node.id}`, { method: "DELETE" });
    } catch (e) {
      toast(errMsg(e, "Could not delete folder"), { kind: "error" });
      return;
    }
    emitChanged();
    if (activeFolder === node.id) router.push("/dashboard");
    toast(`Deleted “${node.label}”`, {
      action: f && {
        label: "Undo",
        onClick: () => {
          void api("/api/v1/folders", { method: "POST", body: { id: f.id, name: f.name, color: f.color } })
            .then(emitChanged);
        },
      },
    });
  };

  const deleteProjectNode = async (node: TreeNode) => {
    const p = projects.find((x) => x.id === node.id);
    try {
      await api(`/api/v1/projects/${node.id}`, { method: "DELETE" });
    } catch (e) {
      toast(errMsg(e, "Could not delete project"), { kind: "error" });
      return;
    }
    emitChanged();
    if (activeProject === node.id) router.push("/dashboard/projects");
    toast(`Deleted “${node.label}”`, {
      action: p && {
        label: "Undo",
        onClick: () => {
          // recreates the project; threads keep living under "All threads"
          void api("/api/v1/projects", { method: "POST", body: { name: p.name, color: p.color } })
            .then(emitChanged);
        },
      },
    });
  };

  const deleteThreadNode = async (node: TreeNode) => {
    try {
      await api(`/api/v1/threads/${node.id}`, { method: "DELETE" });
    } catch (e) {
      toast(errMsg(e, "Could not delete thread"), { kind: "error" });
      return;
    }
    emitChanged();
    toast(`Deleted “${node.label}”`);
  };

  const persistOrder = (kind: "folders" | "projects") => (ids: string[]) => {
    // optimistic local order, then persist each row's index; on any failure
    // re-fetch the authoritative order rather than leaving a silent divergence
    const prevFolders = folders;
    const prevProjects = projects;
    if (kind === "folders") {
      const byId = new Map(folders.map((f) => [f.id, f]));
      setFolders(ids.map((i) => byId.get(i)!).filter(Boolean));
    } else {
      const byId = new Map(projects.map((p) => [p.id, p]));
      setProjects(ids.map((i) => byId.get(i)!).filter(Boolean));
    }
    void Promise.all(
      ids.map((id, i) => api(`/api/v1/${kind}/${id}`, { method: "PATCH", body: { sortOrder: i } })),
    ).catch(() => {
      if (kind === "folders") setFolders(prevFolders);
      else setProjects(prevProjects);
      toast("Could not save the new order", { kind: "error" });
    });
  };

  const moveThreadToProject = async (threadId: string, projectId: string) => {
    try {
      await api(`/api/v1/threads/${threadId}`, { method: "PATCH", body: { projectId } });
      emitChanged();
      toast("Thread moved");
    } catch (e) {
      toast(errMsg(e, "Could not move thread"), { kind: "error" });
    }
  };

  const flatItem = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`flex h-8 items-center rounded-md px-2 text-sm transition-colors duration-[120ms] ${
        pathname === href ? "bg-ink/[0.06] font-medium text-ink" : "text-dim hover:bg-ink/[0.04] hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

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
      {/* glass scrim — the page stays faintly visible under the drawer */}
      <div
        className={`fixed inset-0 z-30 bg-ink/25 backdrop-blur-[2px] transition-opacity duration-200 ease-out md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <aside
        style={{ width }}
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-line bg-raised px-3 py-4 transition-[transform,visibility] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] md:relative md:visible md:translate-x-0 md:transition-none ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Link href="/" className="mb-5 px-2 font-display text-xl font-light tracking-tight">
          Prompt Diary
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <TreeSection
            id="prompts"
            title="My Prompts"
            titleHref="/dashboard"
            nodes={promptNodes}
            activeId={activeTab === "pinned" ? "pinned" : activeFolder}
            isTitleActive={onPrompts && !activeFolder && !activeTab}
            onNavigate={navigate}
            onRename={renameItem("folders")}
            onDelete={deleteFolderNode}
            onReorder={persistOrder("folders")}
            onCreate={async (name) => {
              const folder = await api<Folder>("/api/v1/folders", { method: "POST", body: { name } });
              emitChanged();
              router.push(`/dashboard?folder=${folder.id}`);
            }}
            emptyLabel="No folders yet"
          />

          <TreeSection
            id="projects"
            title="Projects"
            titleHref="/dashboard/projects"
            nodes={projectNodes}
            activeId={activeThread ?? activeProject}
            isTitleActive={pathname === "/dashboard/projects" && !activeProject}
            onNavigate={navigate}
            onRename={(node, name) =>
              renameItem(threads.some((t) => t.id === node.id) ? "threads" : "projects")(node, name)
            }
            onDelete={(node) =>
              threads.some((t) => t.id === node.id) ? deleteThreadNode(node) : deleteProjectNode(node)
            }
            onReorder={persistOrder("projects")}
            onDropInto={moveThreadToProject}
            onCreate={async (name) => {
              await api("/api/v1/projects", { method: "POST", body: { name } });
              emitChanged();
            }}
            emptyLabel="No projects yet"
          />

          <TreeSection
            id="teams"
            title="Teams"
            titleHref="/dashboard/teams"
            nodes={teamNodes}
            activeId={activeTeam}
            isTitleActive={pathname === "/dashboard/teams" && !activeTeam}
            onNavigate={navigate}
            onCreate={async (name) => {
              try {
                const t = await api<TeamRow>("/api/v1/teams", { method: "POST", body: { name } });
                emitChanged();
                router.push(`/dashboard/teams?t=${t.id}`);
              } catch (e) {
                toast(e instanceof Error ? e.message : "Could not create team", { kind: "error" });
              }
            }}
            emptyLabel="No teams yet"
          />

          {/* Tags — derived, always visible, click to filter / click again to clear */}
          <TreeSection
            id="tags"
            title="Tags"
            titleHref="/dashboard"
            nodes={tagNodes}
            activeId={activeTag ? `tag:${activeTag}` : null}
            onNavigate={navigate}
            staticSection
          />

          <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-3">
            {flatItem("/dashboard/usage", "Usage")}
            {flatItem("/gallery", "Public Gallery")}
            {flatItem("/dashboard/profile", "Profile")}
          </div>
        </nav>

        <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1 pt-3">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-ink">
              {(session.user.name || session.user.email).charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{session.user.name}</span>
            <span className="block truncate text-xs text-dim">{session.user.email}</span>
          </span>
          <button
            className="text-xs font-semibold text-dim hover:text-danger"
            title="Sign out"
            onClick={() => void signOut().then(() => router.push("/"))}
          >
            Exit
          </button>
        </div>

        {/* drag-to-resize edge */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="absolute -right-0.5 top-0 hidden h-full w-1.5 cursor-col-resize hover:bg-ink/10 md:block"
          onPointerDown={startResize}
        />
      </aside>
    </>
  );
}
