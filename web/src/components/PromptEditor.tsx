"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Folder, Prompt, Visibility } from "shared";
import { api } from "@/lib/client-api";
import { uploadImage } from "@/lib/upload";
import { toast } from "@/components/Toast";

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

  useEffect(() => {
    if (!id || !loaded) return;
    if (!title.trim() || !body.trim()) return;
    if (Object.keys(diff()).length === 0) return;
    const t = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, tags, folderId, visibility, teamId, pinned, outputBefore, outputAfter, imageBefore, imageAfter]);

  const done = async () => {
    await flush();
    router.push("/dashboard");
  };

  const create = async () => {
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
    await api(`/api/v1/prompts/${id}`, { method: "DELETE" });
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

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => void (id ? done() : router.push("/dashboard"))}>
          ← Back
        </button>
        <input
          className="input flex-1 text-[15px] font-semibold"
          placeholder="Prompt title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!id}
        />
        {id && (
          <span className="w-14 text-right text-xs font-semibold" aria-live="polite">
            {saveState === "saving" && <span className="text-dim">Saving…</span>}
            {saveState === "saved" && <span className="text-accent">Saved ✓</span>}
            {saveState === "error" && <span className="text-danger">Failed</span>}
          </span>
        )}
        {id ? (
          <>
            <button className="btn text-danger" onClick={() => void remove()}>
              Delete
            </button>
            <button className="btn-primary px-4" onClick={() => void done()}>
              Done <span className="kbd ml-1">⌘↵</span>
            </button>
          </>
        ) : (
          <button
            className="btn-primary px-4"
            disabled={!title.trim() || !body.trim()}
            onClick={() => void create()}
          >
            Save <span className="kbd ml-1">⌘↵</span>
          </button>
        )}
      </div>

      <div className="grid min-h-0 flex-[1.2] grid-cols-1 gap-3 md:grid-cols-2">
        <OutputPane
          label="BEFORE — output without this prompt"
          accent={false}
          text={outputBefore}
          onText={setOutputBefore}
          image={imageBefore}
          onImage={setImageBefore}
        />
        <OutputPane
          label="AFTER — output with this prompt"
          accent
          text={outputAfter}
          onText={setOutputAfter}
          image={imageAfter}
          onImage={setImageAfter}
        />
      </div>

      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-line px-3 py-1.5 text-xs font-semibold text-dim">
          THE PROMPT
        </div>
        <textarea
          className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-dim"
          placeholder="Your prompt…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-52"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <select className="input max-w-40" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          className="input max-w-40"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
        >
          <option value="private">Private (closed)</option>
          <option value="public">Public (open source)</option>
        </select>
        <select className="input max-w-40" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">No team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              Share: {t.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-dim">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin
        </label>
      </div>
    </div>
  );
}

function OutputPane({
  label,
  accent,
  text,
  onText,
  image,
  onImage,
}: {
  label: string;
  accent: boolean;
  text: string;
  onText: (v: string) => void;
  image: string | null;
  onImage: (v: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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

  return (
    <div
      className={`panel flex min-h-0 flex-col overflow-hidden ${accent ? "border-accent/40" : ""}`}
    >
      <div
        className={`flex items-center border-b border-line px-3 py-1.5 text-xs font-semibold ${
          accent ? "bg-tint text-accent" : "text-dim"
        }`}
      >
        <span className="flex-1">{label}</span>
        <button
          className="text-xs font-semibold text-accent hover:underline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : image ? "Replace image" : "+ Screenshot"}
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
        <div className="relative border-b border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="output screenshot" className="max-h-40 w-full object-contain" />
          <button
            className="absolute right-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[11px] font-semibold text-white"
            onClick={() => onImage(null)}
          >
            Remove
          </button>
        </div>
      )}
      <textarea
        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-dim"
        placeholder={image ? "Notes (optional)…" : "Paste text — or add a screenshot instead."}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
    </div>
  );
}
