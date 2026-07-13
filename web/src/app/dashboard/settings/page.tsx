"use client";

import type { Folder, Prompt } from "shared";
import { api } from "@/lib/client-api";

export default function SettingsPage() {
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card space-y-3">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-dim">
          Download all your prompts and folders as a JSON file.
        </p>
        <button className="btn-primary" onClick={() => void exportJson()}>
          Export JSON
        </button>
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
