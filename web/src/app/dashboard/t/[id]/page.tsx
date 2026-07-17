"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, ImagePlus, Link2, X } from "lucide-react";
import type { Prompt } from "shared";
import { api } from "@/lib/client-api";
import { useApi } from "@/lib/query";
import { SOURCE_DOTS, sourceOf as siteOf } from "@/lib/sources";
import { uploadImage } from "@/lib/upload";
import { toast } from "@/components/Toast";
import { Select } from "@/components/ui/Select";
import { Tip } from "@/components/ui/Tooltip";

interface Step {
  order: number;
  note: string | null;
  prompt: Prompt;
}

interface ThreadDetail {
  id: string;
  title: string;
  projectId: string | null;
  finalOutput: string | null;
  finalImage: string | null;
  visibility: "private" | "public";
  steps: Step[];
}

interface ProjectRow {
  id: string;
  name: string;
  color: string;
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // thread stays useState + reload: it's a locally-edited draft (title,
  // selects, final output mutate it via setThread before each save), and a
  // useApi background refetch would clobber in-progress edits
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const { data: projects = [] } = useApi<ProjectRow[]>("/api/v1/projects");
  const { data: allPrompts = [] } = useApi<Prompt[]>("/api/v1/prompts");
  const [addQuery, setAddQuery] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    void api<ThreadDetail>(`/api/v1/threads/${id}`)
      .then(setThread)
      .catch(() => {
        toast("Thread not found", { kind: "error" });
        router.push("/dashboard/projects");
      });
  }, [id, router]);

  useEffect(() => {
    reload();
  }, [reload]);

  const patch = async (body: Record<string, unknown>) => {
    setSaveState("saving");
    try {
      await api(`/api/v1/threads/${id}`, { method: "PATCH", body });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", { kind: "error" });
      setSaveState("idle");
    }
  };

  const stepIds = useMemo(
    () => (thread ? [...thread.steps].sort((a, b) => a.order - b.order).map((s) => s.prompt.id) : []),
    [thread],
  );

  const setSteps = async (ids: string[]) => {
    await patch({ promptIds: ids });
    reload();
  };

  const move = (idx: number, dir: -1 | 1) => {
    const ids = [...stepIds];
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return;
    const a = ids[idx];
    const b = ids[target];
    if (a === undefined || b === undefined) return;
    ids[idx] = b;
    ids[target] = a;
    void setSteps(ids);
  };

  const copyAll = () => {
    if (!thread) return;
    const text = [...thread.steps]
      .sort((a, b) => a.order - b.order)
      .map((s, i) => `# Step ${i + 1}: ${s.prompt.title}\n${s.prompt.body}`)
      .join("\n\n");
    void navigator.clipboard.writeText(text);
    toast("Whole recipe copied");
  };

  const addable = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return [];
    const inThread = new Set(stepIds);
    return allPrompts
      .filter((p) => !inThread.has(p.id) && p.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [addQuery, allPrompts, stepIds]);

  if (!thread) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col gap-3">
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton min-h-0 flex-1" />
      </div>
    );
  }

  const sites = [...new Set(thread.steps.map((s) => siteOf(s.prompt)).filter(Boolean))] as string[];

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      {/* top bar — ghost back, autosave, quiet actions; wraps at phone widths
          so Delete never renders past the viewport edge */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-body transition-[background-color,color,transform] hover:bg-hover hover:text-ink active:scale-[0.97]"
          onClick={() => router.push("/dashboard/projects")}
        >
          <ArrowLeft size={15} /> Projects
        </button>
        <span className="flex-1" />
        <span className="text-sm" aria-live="polite">
          {saveState === "saving" && <span className="text-dim">Saving…</span>}
          {saveState === "saved" && <span className="text-success">Saved ✓</span>}
        </span>
        <Select
          className="h-9 max-w-40"
          ariaLabel="Project"
          value={thread.projectId ?? ""}
          onValueChange={(val) => {
            const v = val || null;
            setThread({ ...thread, projectId: v });
            // reload so a failed save reverts the select instead of lying,
            // matching the visibility select below
            void patch({ projectId: v }).then(reload);
          }}
          options={[
            { value: "", label: "No project" },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <Select
          className="h-9 max-w-32"
          ariaLabel="Visibility"
          value={thread.visibility}
          onValueChange={(val) => {
            const v = val as "private" | "public";
            setThread({ ...thread, visibility: v });
            // reload after the round-trip — publishing can 403 on unverified
            // email, and the select must snap back rather than lie
            void patch({ visibility: v }).then(reload);
          }}
          options={[
            { value: "private", label: "Private" },
            { value: "public", label: "Public" },
          ]}
        />
        {thread.visibility === "public" && (
          <Tip label="Anyone with the link can view this recipe">
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(`${location.origin}/r/${thread.id}`);
                toast("Share link copied");
              }}
            >
              <Link2 size={13} /> Share
            </button>
          </Tip>
        )}
        <button className="btn" onClick={copyAll}>
          <Copy size={13} /> Copy all
        </button>
        {confirmingDelete ? (
          // inline confirm replaces the button — no modal
          <span className="flex items-center gap-3 text-sm">
            <span className="text-danger">Delete this thread?</span>
            <button
              className="font-medium text-danger hover:underline"
              onClick={async () => {
                await api(`/api/v1/threads/${id}`, { method: "DELETE" });
                router.push("/dashboard/projects");
              }}
            >
              Delete
            </button>
            <button className="text-dim hover:text-ink" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            className="rounded-lg px-2 py-1.5 text-sm text-danger transition-[background-color,transform] hover:bg-danger/5 active:scale-[0.97]"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        )}
      </div>

      {/* the page's one Waldenburg moment — an editable headline */}
      <div>
        <input
          className="w-full border-b border-transparent bg-transparent pb-1 font-display text-2xl font-light tracking-[-0.015em] text-ink outline-none transition-colors placeholder:text-dim focus:border-line-strong"
          placeholder="Untitled thread"
          value={thread.title}
          onChange={(e) => setThread({ ...thread, title: e.target.value })}
          onBlur={() => void patch({ title: thread.title.trim() || "Untitled thread" })}
        />
        {sites.length > 0 && (
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            {sites.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-dim">→</span>}
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_DOTS[s] }} />
                  {s}
                </span>
              </span>
            ))}
          </p>
        )}
      </div>

      {/* the recipe — numbered manuscript steps */}
      <div className="panel min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {thread.steps.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-dim">
            No steps yet — search your prompts below, or turn on “record to
            thread” in the extension popup.
          </p>
        )}
        {[...thread.steps]
          .sort((a, b) => a.order - b.order)
          .map((s, i, arr) => {
            const site = siteOf(s.prompt);
            return (
              <div
                key={s.prompt.id}
                className="group flex gap-4 px-4 py-3.5 transition-colors duration-[120ms] ease-out hover:bg-soft"
              >
                <span className="w-7 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {s.prompt.title}
                    </span>
                    {site && (
                      <span className="chip shrink-0 gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_DOTS[site] }} />
                        {site}
                      </span>
                    )}
                    <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
                      <Tip label="Copy step">
                      <button
                        aria-label="Copy step"
                        className="icon-btn hover:bg-ink/[0.06] hover:text-ink"
                        onClick={() => {
                          void navigator.clipboard.writeText(s.prompt.body);
                          toast("Step copied");
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      </Tip>
                      <Tip label="Move up">
                      <button
                        aria-label="Move up"
                        className="icon-btn hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      </Tip>
                      <Tip label="Move down">
                      <button
                        aria-label="Move down"
                        className="icon-btn hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                        disabled={i === arr.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      </Tip>
                      <Tip label="Remove from thread (prompt is kept)">
                      <button
                        aria-label="Remove step"
                        className="icon-btn hover:bg-danger/10 hover:text-danger"
                        onClick={() => void setSteps(stepIds.filter((x) => x !== s.prompt.id))}
                      >
                        <X size={14} />
                      </button>
                      </Tip>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-xs leading-relaxed tracking-tight text-dim">
                    {s.prompt.body}
                  </p>
                </div>
              </div>
            );
          })}

        {/* add step */}
        <div className="px-4 py-3">
          <input
            className="input"
            placeholder="+ Add step — search your prompts…"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
          />
          {addable.map((p) => (
            <button
              key={p.id}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-[120ms] hover:bg-hover"
              onClick={() => {
                setAddQuery("");
                void setSteps([...stepIds, p.id]);
              }}
            >
              <span className="truncate">{p.title}</span>
              <span className="ml-auto shrink-0 text-xs font-medium text-dim">add →</span>
            </button>
          ))}
        </div>
      </div>

      {/* final output — the deliverable, the page's primary surface */}
      <div className="flex min-h-0 flex-[0.7] flex-col">
        <div className="mb-1.5 flex items-center">
          <span className="flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            Final output{" "}
            <span className="font-normal normal-case tracking-normal text-dim">
              — what this recipe produced
            </span>
          </span>
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink transition-[background-color,transform] hover:bg-hover active:scale-[0.97] disabled:opacity-50"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={13} />
            {uploading ? "Uploading…" : thread.finalImage ? "Replace" : "Screenshot"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploading(true);
              try {
                const url = await uploadImage(f);
                setThread({ ...thread, finalImage: url });
                await patch({ finalImage: url });
                reload(); // reconcile — a failed patch shouldn't leave a phantom image
              } catch (err) {
                toast(err instanceof Error ? err.message : "Upload failed", { kind: "error" });
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-soft">
          {thread.finalImage && (
            <div className="relative m-3 mb-0 overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thread.finalImage} alt="final output" className="max-h-36 w-full object-contain" />
              <button
                className="absolute right-2 top-2 rounded-md bg-ink/70 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                onClick={() => {
                  setThread({ ...thread, finalImage: null });
                  void patch({ finalImage: null }).then(reload);
                }}
              >
                Remove
              </button>
            </div>
          )}
          <textarea
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed tracking-tight text-ink outline-none placeholder:text-dim"
            placeholder="What did this chain produce? Paste the result, metrics, or notes…"
            value={thread.finalOutput ?? ""}
            onChange={(e) => setThread({ ...thread, finalOutput: e.target.value })}
            onBlur={() => void patch({ finalOutput: thread.finalOutput?.trim() || null })}
          />
        </div>
      </div>
    </div>
  );
}
