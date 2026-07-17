"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ImagePlus, Link2, Star } from "lucide-react";
import type { Folder, Prompt, Visibility } from "shared";
import { api } from "@/lib/client-api";
import { uploadImage } from "@/lib/upload";
import { toast } from "@/components/Toast";
import { Select } from "@/components/ui/Select";

interface TeamRow {
  id: string;
  name: string;
  role: "owner" | "member";
}

type Props = { id: string | null; defaultFolderId?: string | null };

export function PromptEditor({ id, defaultFolderId = null }: Props) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(id === null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [teamId, setTeamId] = useState("");
  const [pinned, setPinned] = useState(false);
  const [outputBefore, setOutputBefore] = useState("");
  const [outputAfter, setOutputAfter] = useState("");
  const [imageBefore, setImageBefore] = useState<string | null>(null);
  const [imageAfter, setImageAfter] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    void api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {});
    void api<TeamRow[]>("/api/v1/teams").then(setTeams).catch(() => {});
    if (!id) return;
    void api<Prompt>(`/api/v1/prompts/${id}`)
      .then((p) => {
        setPrompt(p);
        setTitle(p.title);
        setBody(p.body);
        setTags(p.tags.join(", "));
        setFolderId(p.folderId ?? "");
        setVisibility(p.visibility);
        setTeamId(p.teamId ?? "");
        setPinned(p.pinned);
        setOutputBefore(p.outputBefore ?? "");
        setOutputAfter(p.outputAfter ?? "");
        setImageBefore(p.imageBefore);
        setImageAfter(p.imageAfter);
        lastSaved.current = null; // set below after state settles
        setLoaded(true);
      })
      .catch(() => {
        toast("Prompt not found", { kind: "error" });
        router.push("/dashboard");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const buildPayload = () => ({
    title: title.trim(),
    body: body.trim(),
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20),
    folderId: folderId || null,
    visibility,
    teamId: teamId || null,
    pinned,
    outputBefore: outputBefore.trim() || null,
    outputAfter: outputAfter.trim() || null,
    imageBefore,
    imageAfter,
  });
  type Payload = ReturnType<typeof buildPayload>;
  const lastSaved = useRef<Payload | null>(null);

  // snapshot once the loaded prompt state has rendered
  useEffect(() => {
    if (id && loaded && prompt && lastSaved.current === null) {
      lastSaved.current = buildPayload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, prompt]);

  const diff = (): Partial<Payload> => {
    const current = buildPayload();
    const prev = lastSaved.current;
    if (!prev) return {};
    const changed: Record<string, unknown> = {};
    for (const key of Object.keys(current) as Array<keyof Payload>) {
      if (JSON.stringify(current[key]) !== JSON.stringify(prev[key])) {
        changed[key] = current[key];
      }
    }
    return changed as Partial<Payload>;
  };

  const flush = async () => {
    if (!id || savingRef.current || !lastSaved.current) return;
    // an empty title/body would 400 server-side (schema min 1) and take the
    // REST of the delta down with it — hold the save, same guard as autosave
    if (!title.trim() || !body.trim()) return;
    savingRef.current = true;
    try {
      let delta = diff();
      while (Object.keys(delta).length > 0) {
        setSaveState("saving");
        await api(`/api/v1/prompts/${id}`, { method: "PATCH", body: delta });
        lastSaved.current = { ...(lastSaved.current as Payload), ...delta };
        delta = diff();
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  };

  // "Saved ✓" fades out after 2s
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  useEffect(() => {
    if (!id || !loaded) return;
    if (!title.trim() || !body.trim()) return;
    if (Object.keys(diff()).length === 0) return;
    const t = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, tags, folderId, visibility, teamId, pinned, outputBefore, outputAfter, imageBefore, imageAfter]);

  // a pending debounced save is lost if the user navigates away (sidebar link,
  // list row, back button) before the 1200ms timer fires — done() flushes but
  // those paths don't. Mirror the latest flush into a ref and run it once on
  // unmount; flush() no-ops when there's nothing to save.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  const done = async () => {
    await flush();
    router.push("/dashboard");
  };

  const create = async () => {
    if (!title.trim() || !body.trim()) return; // ⌘↵ can reach here with an empty form
    try {
      await api("/api/v1/prompts", { method: "POST", body: buildPayload() });
      toast("Prompt saved");
      router.push("/dashboard");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", { kind: "error" });
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await api(`/api/v1/prompts/${id}`, { method: "DELETE" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete prompt", { kind: "error" });
      return;
    }
    toast("Prompt deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          void api(`/api/v1/prompts/${id}/restore`, { method: "POST" }).then(() =>
            toast("Restored"),
          );
        },
      },
    });
    router.push("/dashboard");
  };

  // keyboard: Esc = done/back, mod+Enter = done/create
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void (id ? done() : router.push("/dashboard"));
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void (id ? done() : create());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, title, body, tags, folderId, visibility, teamId, pinned, outputBefore, outputAfter, imageBefore, imageAfter]);

  if (!loaded) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="skeleton h-8 w-2/5" />
        <div className="skeleton min-h-0 flex-1" />
      </div>
    );
  }

  const canSave = !!title.trim() && !!body.trim();
  const kbdHint = (
    <span className="rounded bg-white/15 px-1 font-mono text-[10px] font-semibold uppercase tracking-wide">
      ⌘↵
    </span>
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
      {/* top bar */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-body transition-colors hover:bg-hover hover:text-ink"
          onClick={() => void (id ? done() : router.push("/dashboard"))}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span className="flex-1" />
        {id && (
          <span className="text-sm" aria-live="polite">
            {saveState === "saving" && <span className="text-dim">Saving…</span>}
            {saveState === "saved" && <span className="text-success">Saved ✓</span>}
            {saveState === "error" && <span className="text-danger">Save failed</span>}
          </span>
        )}
        {id ? (
          confirmingDelete ? (
            // inline confirm replaces the button pair — no modal
            <span className="flex items-center gap-3 text-sm">
              <span className="text-danger">Delete this prompt?</span>
              <button className="font-medium text-danger hover:underline" onClick={() => void remove()}>
                Delete
              </button>
              <button className="text-dim hover:text-ink" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <>
              {/* reachable but clearly secondary */}
              <button
                className="rounded-lg px-2 py-1.5 text-sm text-danger transition-colors hover:bg-danger/5"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
              <button className="btn-primary" onClick={() => void done()}>
                Done {kbdHint}
              </button>
            </>
          )
        ) : canSave ? (
          <button className="btn-primary" onClick={() => void create()}>
            Save {kbdHint}
          </button>
        ) : (
          <button
            className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-full bg-tint px-5 text-sm font-medium text-dim"
            disabled
          >
            Save{" "}
            <span className="rounded bg-ink/[0.06] px-1 font-mono text-[10px] font-semibold uppercase tracking-wide">
              ⌘↵
            </span>
          </button>
        )}
      </div>

      {/* the page's one Waldenburg moment — a headline that happens to be editable */}
      <input
        className="w-full border-b border-transparent bg-transparent pb-1 font-display text-2xl font-light tracking-tight text-ink outline-none transition-colors placeholder:text-dim focus:border-line-strong"
        placeholder="Untitled prompt"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!id}
      />

      {/* before / after — one comparison, not two disconnected boxes */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-0">
        <OutputPane
          label="Before"
          sublabel="output without this prompt"
          text={outputBefore}
          onText={setOutputBefore}
          image={imageBefore}
          onImage={setImageBefore}
        />
        <div className="hidden items-center px-3 md:flex" aria-hidden>
          <ArrowRight size={16} className="text-dim" />
        </div>
        <OutputPane
          label="After"
          sublabel="output with this prompt"
          text={outputAfter}
          onText={setOutputAfter}
          image={imageAfter}
          onImage={setImageAfter}
        />
      </div>

      {/* the prompt itself — the primary surface, not a third identical box */}
      <div className="flex min-h-0 flex-[1.4] flex-col">
        <span className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
          The Prompt
        </span>
        <textarea
          className="min-h-0 flex-1 resize-none rounded-xl bg-soft p-6 font-mono text-[16px] leading-relaxed tracking-tight text-ink outline-none transition-shadow placeholder:text-dim focus:ring-2 focus:ring-inset focus:ring-ink/10"
          placeholder="Your prompt…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {/* footer controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input h-11 max-w-56"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Select
          className="h-11 max-w-44"
          ariaLabel="Folder"
          value={folderId}
          onValueChange={setFolderId}
          options={[
            { value: "", label: "No folder" },
            ...folders.map((f) => ({ value: f.id, label: f.name })),
          ]}
        />
        <Select
          className="h-11 max-w-44"
          ariaLabel="Visibility"
          value={visibility}
          onValueChange={(v) => setVisibility(v as Visibility)}
          options={[
            { value: "private", label: "Private (closed)" },
            { value: "public", label: "Public (open source)" },
          ]}
        />
        <Select
          className="h-11 max-w-44"
          ariaLabel="Team sharing"
          value={teamId}
          onValueChange={setTeamId}
          options={[
            { value: "", label: "No team" },
            ...teams.map((t) => ({ value: t.id, label: `Share: ${t.name}` })),
          ]}
        />
        {visibility === "public" && id && (
          <button
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm font-medium text-dim transition-colors hover:bg-hover hover:text-ink"
            title="Anyone with the link can view this prompt"
            onClick={() => {
              void navigator.clipboard.writeText(`${location.origin}/p/${id}`);
              toast("Share link copied");
            }}
          >
            <Link2 size={14} /> Share link
          </button>
        )}
        {/* same star vocabulary as the sidebar's Pinned */}
        <button
          className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
            pinned
              ? "bg-ink text-white"
              : "border border-line-strong text-dim hover:bg-hover hover:text-ink"
          }`}
          aria-pressed={pinned}
          onClick={() => setPinned((v) => !v)}
        >
          <Star size={14} className={pinned ? "fill-current" : ""} /> Pin
        </button>
      </div>
    </div>
  );
}

function OutputPane({
  label,
  sublabel,
  text,
  onText,
  image,
  onImage,
}: {
  label: string;
  sublabel: string;
  text: string;
  onText: (v: string) => void;
  image: string | null;
  onImage: (v: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const pick = async (file: File) => {
    setUploading(true);
    try {
      onImage(await uploadImage(file));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", { kind: "error" });
    } finally {
      setUploading(false);
    }
  };

  const imageFromDataTransfer = (dt: DataTransfer): File | null => {
    for (const item of dt.items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        return item.getAsFile();
      }
    }
    return null;
  };

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-raised transition-colors ${
        isDragOver ? "border-ink" : "border-line"
      }`}
      onDragOver={(e) => {
        if (imageFromDataTransfer(e.dataTransfer) !== null || e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        const f = imageFromDataTransfer(e.dataTransfer);
        if (f) {
          e.preventDefault();
          void pick(f);
        }
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="flex-1 truncate text-xs font-semibold uppercase tracking-[0.08em] text-dim">
          {label} <span className="font-normal normal-case tracking-normal text-dim">— {sublabel}</span>
        </span>
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-hover disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <ImagePlus size={13} />
          {uploading ? "Uploading…" : image ? "Replace" : "Screenshot"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = "";
          }}
        />
      </div>
      {image && (
        <div className="relative mx-4 mt-2 overflow-hidden rounded-lg border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="output screenshot" className="max-h-40 w-full object-contain" />
          <button
            className="absolute right-2 top-2 rounded-md bg-ink/70 px-1.5 py-0.5 text-[11px] font-semibold text-white"
            onClick={() => onImage(null)}
          >
            Remove
          </button>
        </div>
      )}
      <textarea
        className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed tracking-tight text-ink outline-none placeholder:text-dim"
        placeholder={image ? "Notes (optional)…" : "Paste text, or drop a screenshot here"}
        value={text}
        onChange={(e) => onText(e.target.value)}
        onPaste={(e) => {
          const f = imageFromDataTransfer(e.clipboardData);
          if (f) {
            e.preventDefault();
            void pick(f);
          }
        }}
      />
    </div>
  );
}
