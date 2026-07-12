"use client";

import { useRef, useState } from "react";
import type { Folder, Prompt } from "shared";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = async () => {
    const [prompts, folders] = await Promise.all([
      api<Prompt[]>("/api/v1/prompts"),
      api<Folder[]>("/api/v1/folders"),
    ]);
    const blob = new Blob(
      [JSON.stringify({ version: 1, prompts, folders }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-diary-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as {
        prompts?: Prompt[];
        folders?: Folder[];
      };
      const folders = parsed.folders ?? [];
      const prompts = parsed.prompts ?? [];
      for (const f of folders) {
        await api("/api/v1/folders", {
          method: "POST",
          body: { id: f.id, name: f.name, color: f.color },
        }).catch(() => {}); // already exists → skip
      }
      let imported = 0;
      for (const p of prompts) {
        await api("/api/v1/prompts", {
          method: "POST",
          body: {
            id: p.id,
            title: p.title,
            body: p.body,
            tags: p.tags,
            folderId: p.folderId,
            visibility: p.visibility === "team" ? "private" : p.visibility,
            pinned: p.pinned,
          },
        })
          .then(() => imported++)
          .catch(() => {});
      }
      setMessage(`Imported ${imported} prompts.`);
    } catch {
      setMessage("Import failed: not a valid backup file.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card space-y-2">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-dim">
          {session?.user.name} · {session?.user.email}
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-dim">
          Export all your prompts and folders as JSON, or import a previous
          backup. Imported team prompts fall back to private.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => void exportJson()}>
            Export JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = "";
            }}
          />
        </div>
        {message && <p className="text-sm text-accent">{message}</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Chrome extension</h2>
        <p className="text-sm text-dim">
          Install the Prompt Diary extension, sign in with the same account,
          and your vault syncs automatically. Highlight any text → right-click
          → “Save to Prompt Diary”.
        </p>
      </div>
    </div>
  );
}
