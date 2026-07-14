"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Prompt } from "shared";
import { api } from "@/lib/client-api";
import { uploadImage } from "@/lib/upload";
import { toast } from "@/components/Toast";

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
  steps: Step[];
}

interface ProjectRow {
  id: string;
  name: string;
  color: string;
}

const SITE_TAGS = ["chatgpt", "claude", "gemini", "perplexity", "poe"];
const siteOf = (p: Prompt) => p.tags.find((t) => SITE_TAGS.includes(t)) ?? null;

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [addQuery, setAddQuery] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
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
    void api<ProjectRow[]>("/api/v1/projects").then(setProjects).catch(() => {});
    void api<Prompt[]>("/api/v1/prompts").then(setAllPrompts).catch(() => {});
  }, [reload]);

  const patch = async (body: Record<string, unknown>) => {
    setSaveState("saving");
    try {
      await api(`/api/v1/threads/${id}`, { method: "PATCH", body });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
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

  const sites = [...new Set(thread.steps.map((s) => siteOf(s.prompt)).filter(Boolean))];

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => router.push("/dashboard/projects")}>
          ← Projects
        </button>
        <input
          className="input flex-1 text-[15px] font-semibold"
          value={thread.title}
          onChange={(e) => setThread({ ...thread, title: e.target.value })}
          onBlur={() => void patch({ title: thread.title.trim() || "Untitled thread" })}
        />
        <span className="w-14 text-right text-[11px] font-semibold" aria-live="polite">
          {saveState === "saving" && <span className="text-dim">Saving…</span>}
          {saveState === "saved" && <span className="text-accent">Saved ✓</span>}
        </span>
        <select
          className="input max-w-40"
          value={thread.projectId ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setThread({ ...thread, projectId: v });
            void patch({ projectId: v });
          }}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={copyAll}>
          ⧉ Copy all
        </button>
        <button
          className="btn text-danger"
          onClick={async () => {
            if (!window.confirm("Delete this thread? The prompts inside are kept.")) return;
            await api(`/api/v1/threads/${id}`, { method: "DELETE" });
            router.push("/dashboard/projects");
          }}
        >
          Delete
        </button>
      </div>

      {sites.length > 0 && (
        <p className="text-[11px] font-semibold text-dim">
          {sites.join(" → ")}
        </p>
      )}

      {/* the recipe */}
      <div className="panel min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {thread.steps.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-dim">
            No steps yet — search your prompts below, or turn on “record to
            thread” in the extension popup.
          </p>
        )}
        {[...thread.steps]
          .sort((a, b) => a.order - b.order)
          .map((s, i, arr) => {
            const site = siteOf(s.prompt);
            return (
              <div key={s.prompt.id} className="group flex gap-3 px-4 py-3">
                <span className="w-8 shrink-0 pt-0.5 font-mono text-[11px] text-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {site && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-accent">
                        {site}
                      </span>
                    )}
                    <span className="truncate text-[13px] font-semibold">
                      {s.prompt.title}
                    </span>
                    <span className="ml-auto flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="btn h-6 px-2 text-[11px]"
                        onClick={() => {
                          void navigator.clipboard.writeText(s.prompt.body);
                          toast("Step copied");
                        }}
                      >
                        Copy
                      </button>
                      <button className="btn h-6 px-2 text-[11px]" disabled={i === 0} onClick={() => move(i, -1)}>
                        ↑
                      </button>
                      <button className="btn h-6 px-2 text-[11px]" disabled={i === arr.length - 1} onClick={() => move(i, 1)}>
                        ↓
                      </button>
                      <button
                        className="btn h-6 px-2 text-[11px] text-danger"
                        onClick={() => void setSteps(stepIds.filter((x) => x !== s.prompt.id))}
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-[11.5px] leading-relaxed text-dim">
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
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover"
              onClick={() => {
                setAddQuery("");
                void setSteps([...stepIds, p.id]);
              }}
            >
              <span className="truncate">{p.title}</span>
              <span className="ml-auto text-[11px] text-accent">add →</span>
            </button>
          ))}
        </div>
      </div>

      {/* final output — the deliverable */}
      <div className="panel flex min-h-0 flex-[0.7] flex-col overflow-hidden border-accent/40">
        <div className="flex items-center border-b border-line bg-tint px-3 py-1.5 text-[11px] font-semibold text-accent">
          <span className="flex-1">FINAL OUTPUT — what this recipe produced</span>
          <button
            className="text-[11px] font-semibold text-accent hover:underline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : thread.finalImage ? "Replace image" : "+ Screenshot"}
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
              } catch (err) {
                toast(err instanceof Error ? err.message : "Upload failed", { kind: "error" });
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
        {thread.finalImage && (
          <div className="relative border-b border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thread.finalImage} alt="final output" className="max-h-36 w-full object-contain" />
            <button
              className="absolute right-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-white"
              onClick={() => {
                setThread({ ...thread, finalImage: null });
                void patch({ finalImage: null });
              }}
            >
              Remove
            </button>
          </div>
        )}
        <textarea
          className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-dim"
          placeholder="What did this chain produce? Paste the result, metrics, or notes…"
          value={thread.finalOutput ?? ""}
          onChange={(e) => setThread({ ...thread, finalOutput: e.target.value })}
          onBlur={() => void patch({ finalOutput: thread.finalOutput?.trim() || null })}
        />
      </div>
    </div>
  );
}
