"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { relativeTime } from "@/lib/sources";
import { toast } from "@/components/Toast";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Tip } from "@/components/ui/Tooltip";
import { FOLDERS_CHANGED_EVENT } from "@/components/Sidebar";
import { dialog } from "@/components/Dialog";

const emitChanged = () => window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));

interface ProjectRow {
  id: string;
  name: string;
  color: string;
  threadCount: number;
}

interface ThreadRow {
  id: string;
  title: string;
  projectId: string | null;
  finalOutput: string | null;
  stepCount: number;
  updatedAt: string;
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("p"); // project filter lives in the URL
  const setSelected = (id: string | null) =>
    router.push(id ? `/dashboard/projects?p=${id}` : "/dashboard/projects");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(() => {
    void api<ProjectRow[]>("/api/v1/projects").then(setProjects).catch(() => {});
    void api<ThreadRow[]>("/api/v1/threads")
      .then(setThreads)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(FOLDERS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, reload);
  }, [reload]);

  const fail = (e: unknown, fallback: string) =>
    toast(e instanceof Error ? e.message : fallback, { kind: "error" });

  const newProject = async () => {
    const name = await dialog.prompt({ title: "New project", placeholder: "Project name", submitLabel: "Create" });
    if (!name?.trim()) return;
    try {
      await api("/api/v1/projects", { method: "POST", body: { name: name.trim() } });
      reload();
      emitChanged();
    } catch (e) {
      fail(e, "Could not create project");
    }
  };

  const renameProject = async (p: ProjectRow) => {
    const name = await dialog.prompt({ title: "Rename project", initial: p.name });
    if (!name?.trim() || name.trim() === p.name) return;
    try {
      await api(`/api/v1/projects/${p.id}`, { method: "PATCH", body: { name: name.trim() } });
      reload();
      emitChanged();
    } catch (e) {
      fail(e, "Rename failed");
    }
  };

  const deleteProject = async (p: ProjectRow) => {
    if (!(await dialog.confirm({ title: `Delete project “${p.name}”?`, body: "Its threads are kept.", danger: true }))) return;
    try {
      await api(`/api/v1/projects/${p.id}`, { method: "DELETE" });
      if (selected === p.id) setSelected(null);
      reload();
      emitChanged();
    } catch (e) {
      fail(e, "Could not delete project");
    }
  };

  const deleteThread = async (t: ThreadRow) => {
    if (!(await dialog.confirm({ title: `Delete thread “${t.title}”?`, body: "The prompts inside are kept.", danger: true })))
      return;
    try {
      await api(`/api/v1/threads/${t.id}`, { method: "DELETE" });
      toast("Thread deleted");
      reload();
      emitChanged();
    } catch (e) {
      fail(e, "Could not delete thread");
    }
  };

  const renameThread = async (t: ThreadRow) => {
    const title = await dialog.prompt({ title: "Rename thread", initial: t.title });
    if (!title?.trim() || title.trim() === t.title) return;
    try {
      await api(`/api/v1/threads/${t.id}`, { method: "PATCH", body: { title: title.trim() } });
      reload();
      emitChanged();
    } catch (e) {
      fail(e, "Rename failed");
    }
  };

  const newThread = async () => {
    const title = await dialog.prompt({ title: "New thread", placeholder: "Thread title", submitLabel: "Create" });
    if (!title?.trim()) return;
    const t = await api<ThreadRow>("/api/v1/threads", {
      method: "POST",
      body: { title: title.trim(), projectId: selected },
    });
    toast("Thread created — add steps from your prompts");
    router.push(`/dashboard/t/${t.id}`);
  };

  // looping is the thread-level style facet: computed, never stored —
  // a chain of 3+ steps means the prompt was iterated toward the output
  const [loopingOnly, setLoopingOnly] = useState(false);
  const isLooping = (t: ThreadRow) => t.stepCount >= 3;
  const inProject = selected ? threads.filter((t) => t.projectId === selected) : threads;
  const visible = loopingOnly ? inProject.filter(isLooping) : inProject;
  const selectedProject = projects.find((p) => p.id === selected) ?? null;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        {/* the one Waldenburg moment on this page */}
        <h1 className="flex items-center gap-2 font-display text-2xl font-light tracking-tight">
          {selectedProject?.name ?? "Projects"}
          {!isLoading && (
            <span className="font-sans text-sm font-normal tabular-nums text-dim">
              {visible.length} {visible.length === 1 ? "thread" : "threads"}
            </span>
          )}
          {selectedProject && (
            <Menu
              align="start"
              trigger={
                <button
                  aria-label="Project actions"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-ink/[0.06] hover:text-ink data-[state=open]:bg-ink/[0.06] data-[state=open]:text-ink"
                >
                  <MoreHorizontal size={15} />
                </button>
              }
            >
              <MenuItem onSelect={() => void renameProject(selectedProject)}>Rename project</MenuItem>
              <MenuItem danger onSelect={() => void deleteProject(selectedProject)}>
                Delete project
              </MenuItem>
            </Menu>
          )}
        </h1>
        <span className="flex gap-2">
          <button className="btn" onClick={() => void newProject()}>
            + Project
          </button>
          <button className="btn-primary" onClick={() => void newThread()}>
            + New thread{selected ? " in project" : ""}
          </button>
        </span>
      </div>

      {/* project shelf — chip navigation, same language as the popup */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-[120ms] ${
            selected === null
              ? "border-accent bg-accent text-white"
              : "border-line-strong text-dim hover:bg-hover hover:text-ink"
          }`}
          onClick={() => setSelected(null)}
        >
          All threads
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-[120ms] ${
              selected === p.id
                ? "border-accent bg-accent text-white"
                : "border-line-strong text-dim hover:bg-hover hover:text-ink"
            }`}
            onClick={() => setSelected(selected === p.id ? null : p.id)}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}
            <span className={`tabular-nums ${selected === p.id ? "text-white/70" : "text-dim"}`}>
              {p.threadCount}
            </span>
          </button>
        ))}
        {/* a FILTER, not another project selector — state-toggle language
            (tint fill), separated from the selector chips by a hairline */}
        <span className="ml-auto border-l border-line pl-3">
          <Tip label="Threads with 3+ steps — the prompt was iterated toward the output">
            <button
              className={`inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium transition-colors duration-[120ms] ${
                loopingOnly
                  ? "border-ink bg-tint text-ink"
                  : "border-line-strong text-dim hover:bg-hover hover:text-ink"
              }`}
              aria-pressed={loopingOnly}
              onClick={() => setLoopingOnly((v) => !v)}
            >
              looping
            </button>
          </Tip>
        </span>
      </div>

      {/* thread ledger — two-line manuscript rows */}
      <div className="panel min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {isLoading &&
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="px-4 py-5">
              <div className="skeleton h-4 w-2/5" />
            </div>
          ))}
        {!isLoading && visible.length === 0 && (
          <p className="mx-auto max-w-sm py-14 text-center text-sm leading-relaxed text-dim">
            A thread is a recipe: the chain of prompts that produced one result.
            Create one here, or from the “saves from this conversation” banner
            on My Prompts.
          </p>
        )}
        {!isLoading &&
          visible.map((t) => {
            const project = projects.find((p) => p.id === t.projectId);
            return (
              <div
                key={t.id}
                className="group flex h-16 w-full cursor-pointer items-center gap-4 px-4 transition-colors duration-[120ms] ease-out hover:bg-soft"
                onClick={() => router.push(`/dashboard/t/${t.id}`)}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-medium leading-6 text-ink">
                      {t.title}
                    </span>
                    {t.finalOutput && (
                      <Tip label="Has a final output">
                        <span className="shrink-0 text-xs font-medium text-success">shipped ✓</span>
                      </Tip>
                    )}
                  </span>
                  <span className="block truncate font-mono text-sm leading-5 tracking-tight text-dim">
                    {t.finalOutput?.replace(/\s+/g, " ").trim() ||
                      (t.stepCount > 0 ? `${t.stepCount}-step recipe, no final output yet` : "Empty recipe")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {isLooping(t) && <span className="chip">looping</span>}
                  {project && !selected && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-dim">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />
                      {project.name}
                    </span>
                  )}
                  <span className="text-xs tabular-nums text-dim">
                    {t.stepCount} {t.stepCount === 1 ? "step" : "steps"}
                  </span>
                  <span className="row-passive text-xs text-dim group-hover:hidden">
                    {relativeTime(t.updatedAt)}
                  </span>
                  <span className="hidden items-center gap-0.5 group-hover:flex">
                    <Tip label="Rename thread">
                    <button
                      aria-label="Rename thread"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-ink/[0.06] hover:text-ink"
                      onClick={(e) => {
                        e.stopPropagation();
                        void renameThread(t);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    </Tip>
                    <Tip label="Delete thread">
                    <button
                      aria-label="Delete thread"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-danger/10 hover:text-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteThread(t);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                    </Tip>
                  </span>
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
