"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client-api";
import { toast } from "@/components/Toast";
import { FOLDERS_CHANGED_EVENT } from "@/components/Sidebar";

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

  const newProject = async () => {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    await api("/api/v1/projects", { method: "POST", body: { name: name.trim() } });
    reload();
    emitChanged();
  };

  const renameProject = async (p: ProjectRow) => {
    const name = window.prompt("Rename project", p.name);
    if (!name?.trim() || name.trim() === p.name) return;
    await api(`/api/v1/projects/${p.id}`, { method: "PATCH", body: { name: name.trim() } });
    reload();
    emitChanged();
  };

  const deleteProject = async (p: ProjectRow) => {
    if (!window.confirm(`Delete project "${p.name}"? Its threads are kept.`)) return;
    await api(`/api/v1/projects/${p.id}`, { method: "DELETE" });
    if (selected === p.id) setSelected(null);
    reload();
    emitChanged();
  };

  const deleteThread = async (t: ThreadRow) => {
    if (!window.confirm(`Delete thread "${t.title}"? The prompts inside are kept.`))
      return;
    await api(`/api/v1/threads/${t.id}`, { method: "DELETE" });
    toast("Thread deleted");
    reload();
  };

  const newThread = async () => {
    const title = window.prompt("Thread title");
    if (!title?.trim()) return;
    const t = await api<ThreadRow>("/api/v1/threads", {
      method: "POST",
      body: { title: title.trim(), projectId: selected },
    });
    toast("Thread created — add steps from your prompts");
    router.push(`/dashboard/t/${t.id}`);
  };

  const visible = selected ? threads.filter((t) => t.projectId === selected) : threads;

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">
          Projects
          {!isLoading && (
            <span className="ml-2 text-[13px] font-normal tabular-nums text-dim">
              {threads.length} {threads.length === 1 ? "thread" : "threads"}
            </span>
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

      {/* project shelf */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className={`btn ${selected === null ? "border-accent bg-tint text-accent" : "text-dim"}`}
          onClick={() => setSelected(null)}
        >
          All threads
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={`btn ${selected === p.id ? "border-accent bg-tint text-accent" : ""}`}
            title={`${p.name} — double-click to rename, right-click to delete`}
            onClick={() => setSelected(p.id)}
            onDoubleClick={() => void renameProject(p)}
            onContextMenu={(e) => {
              e.preventDefault();
              void deleteProject(p);
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
            <span className="tabular-nums text-dim">{p.threadCount}</span>
          </button>
        ))}
      </div>

      {/* thread ledger */}
      <div className="panel min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {isLoading &&
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="skeleton h-4 w-2/5" />
            </div>
          ))}
        {!isLoading && visible.length === 0 && (
          <p className="mx-auto max-w-sm py-14 text-center text-[13px] leading-relaxed text-dim">
            A thread is a recipe: the chain of prompts that produced one result.
            Create one here, or from the “saves from this conversation” banner
            on My Prompts.
          </p>
        )}
        {!isLoading &&
          visible.map((t) => {
            const project = projects.find((p) => p.id === t.projectId);
            return (
              <button
                key={t.id}
                className="group flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-hover"
                title={`${t.title} — right-click to delete`}
                onClick={() => router.push(`/dashboard/t/${t.id}`)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  void deleteThread(t);
                }}
              >
                <span className="truncate text-[13px] font-semibold">{t.title}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-dim">
                  {t.stepCount} {t.stepCount === 1 ? "step" : "steps"}
                </span>
                {project && (
                  <span
                    className="shrink-0 text-[11px] font-semibold"
                    style={{ color: project.color }}
                  >
                    {project.name}
                  </span>
                )}
                {t.finalOutput && (
                  <span className="vis-badge shrink-0 text-accent">shipped</span>
                )}
                <span
                  className="ml-auto shrink-0 text-[11px] text-danger opacity-0 transition-opacity group-hover:opacity-100"
                  role="button"
                  tabIndex={0}
                  title="Delete thread"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteThread(t);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      void deleteThread(t);
                    }
                  }}
                >
                  Delete
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
