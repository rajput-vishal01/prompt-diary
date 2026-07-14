"use client";

import { useEffect, useRef, useState } from "react";
import type { Folder, Prompt } from "shared";
import { api } from "@/lib/client-api";
import { uploadImage } from "@/lib/upload";
import { authClient, useSession } from "@/lib/auth-client";

async function exportJson() {
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
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const changeAvatar = async (file: File) => {
    setAvatarUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      await authClient.updateUser({ image: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (session) setName(session.user.name);
  }, [session]);

  if (!session) return null;
  const verified = session.user.emailVerified;

  const saveName = async () => {
    if (!name.trim() || name.trim() === session.user.name) return;
    setSaving(true);
    setError(null);
    const res = await authClient.updateUser({ name: name.trim() });
    setSaving(false);
    if (res.error) {
      setError(res.error.message ?? "Could not save");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sendVerification = async () => {
    setError(null);
    const res = await authClient.sendVerificationEmail({
      email: session.user.email,
      callbackURL: "/dashboard/profile", // clicking the emailed link lands back here, verified
    });
    if (res.error) {
      setError(res.error.message ?? "Could not send the email");
      return;
    }
    setVerifySent(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="card space-y-4">
        <div className="flex items-center gap-4">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt="profile"
              className="h-16 w-16 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-tint text-xl font-bold text-accent">
              {(session.user.name || session.user.email).charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <button
              className="btn"
              disabled={avatarUploading}
              onClick={() => avatarRef.current?.click()}
            >
              {avatarUploading ? "Uploading…" : "Change photo"}
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void changeAvatar(f);
                e.target.value = "";
              }}
            />
            <p className="mt-1 text-[11px] text-dim">Square images look best. Max 5MB.</p>
          </div>
        </div>

        <div>
          <label htmlFor="profile-name" className="mb-1 block text-xs font-semibold text-dim">
            Username
          </label>
          <div className="flex gap-2">
            <input
              id="profile-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
            <button
              className="btn-primary"
              disabled={saving || !name.trim() || name.trim() === session.user.name}
              onClick={() => void saveName()}
            >
              {saving ? "…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
          <p className="mt-1 text-xs text-dim">
            Shown on your public and team prompts.
          </p>
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-1 text-xs font-semibold text-dim">Email</p>
          <p className="text-sm">
            {session.user.email}
            {verified ? (
              <span className="ml-2 font-semibold text-accent">verified ✓</span>
            ) : (
              <span className="ml-2 font-semibold text-amber">unverified</span>
            )}
          </p>
        </div>
      </div>

      {!verified && (
        <div className="card space-y-3 border-accent/40 bg-tint">
          <h2 className="font-semibold">Verify your email</h2>
          <p className="text-sm leading-relaxed text-dim">
            Publishing public prompts, creating teams, and accepting team
            invites require a verified email. We'll send a verification link
            to <span className="font-semibold text-ink">{session.user.email}</span> —
            click it and you'll land back here, verified.
          </p>
          {verifySent ? (
            <p className="text-sm font-semibold text-accent">
              Sent — check your inbox (and spam folder).
            </p>
          ) : (
            <button className="btn-primary" onClick={() => void sendVerification()}>
              Send verification email
            </button>
          )}
        </div>
      )}

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

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
