"use client";

import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/lib/upload";
import { authClient, useSession } from "@/lib/auth-client";

// section anatomy is deliberate: hairline top border + caption label. Later
// sections (API keys, danger zone) slot in without touching the others.
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
        {label}
      </p>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const changeAvatar = async (file: File) => {
    setAvatarUploading(true);
    setError(null);
    const previous = session?.user.image;
    try {
      const url = await uploadImage(file);
      await authClient.updateUser({ image: url });
      // the replaced avatar is an orphan on Cloudinary now — clean it up
      if (previous) {
        void fetch("/api/v1/uploads/destroy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: previous }),
        }).catch(() => {});
      }
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

  // borderless headline input — commit on blur, same as the thread title
  const saveName = async () => {
    if (!name.trim() || name.trim() === session.user.name) return;
    setError(null);
    const res = await authClient.updateUser({ name: name.trim() });
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
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <h1 className="font-display text-3xl font-light tracking-[-0.01em] text-ink">
        Profile
      </h1>

      {/* identity — avatar + editable headline name */}
      <div className="flex items-center gap-5 pb-1">
        <button
          className="group relative shrink-0 rounded-full"
          title="Change photo"
          disabled={avatarUploading}
          onClick={() => avatarRef.current?.click()}
        >
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt="profile"
              className="h-16 w-16 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-tint font-display text-2xl font-light text-ink">
              {(session.user.name || session.user.email).charAt(0).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-ink/50 text-[10px] font-semibold uppercase tracking-wide text-white group-hover:flex">
            {avatarUploading ? "…" : "Change"}
          </span>
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
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <input
              className="w-full min-w-0 border-b border-transparent bg-transparent pb-0.5 font-display text-2xl font-light tracking-tight text-ink outline-none transition-colors placeholder:text-dim/50 focus:border-line-strong"
              value={name}
              maxLength={100}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            {saved && <span className="shrink-0 text-sm text-success">Saved ✓</span>}
          </div>
          <p className="mt-1 text-sm text-dim">
            {session.user.email}
            {verified ? (
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-success">
                verified ✓
              </span>
            ) : (
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-amber">
                unverified
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-dim/80">
            Your name appears on public and team prompts.
          </p>
        </div>
      </div>

      {!verified && (
        <div className="space-y-3 rounded-xl bg-tint p-4">
          <p className="text-sm leading-relaxed text-body">
            Publishing public prompts, creating teams, and accepting team
            invites require a verified email. We&apos;ll send a link to{" "}
            <span className="font-semibold text-ink">{session.user.email}</span>{" "}
            — click it and you&apos;ll land back here, verified.
          </p>
          {verifySent ? (
            <p className="text-sm font-medium text-success">
              Sent — check your inbox (and spam folder).
            </p>
          ) : (
            <button className="btn-primary" onClick={() => void sendVerification()}>
              Send verification email
            </button>
          )}
        </div>
      )}

      <Section label="Keyboard shortcuts">
        <div className="grid gap-1.5 text-sm">
          <p className="flex justify-between">
            <span className="text-dim">Command palette</span>
            <span><span className="kbd">⌘</span> <span className="kbd">K</span></span>
          </p>
          <p className="flex justify-between">
            <span className="text-dim">Focus search</span>
            <span className="kbd">/</span>
          </p>
          <p className="flex justify-between">
            <span className="text-dim">Save & close editor</span>
            <span><span className="kbd">⌘</span> <span className="kbd">↵</span></span>
          </p>
          <p className="flex justify-between">
            <span className="text-dim">Back / close</span>
            <span className="kbd">esc</span>
          </p>
          <p className="flex justify-between">
            <span className="text-dim">Open extension popup</span>
            <span><span className="kbd">Alt</span> <span className="kbd">P</span></span>
          </p>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-dim">
          To change the extension hotkey, Chrome requires you to do it in the
          browser itself:{" "}
          <button
            className="font-mono font-medium text-ink hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText("chrome://extensions/shortcuts");
            }}
            title="Click to copy"
          >
            chrome://extensions/shortcuts
          </button>{" "}
          — click to copy, paste it in the address bar. Or click the{" "}
          <span className="font-semibold text-ink">⌨</span> in the extension
          popup&apos;s footer.
        </p>
      </Section>

      <Section label="Chrome extension">
        <p className="text-sm leading-relaxed text-dim">
          Install the Prompt Diary extension, sign in with the same account,
          and your vault syncs automatically. Highlight any text → right-click
          → “Save to Prompt Diary”.
        </p>
      </Section>

      <DangerZone email={session.user.email} />

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function DangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    const res = await authClient.deleteUser(password ? { password } : {});
    if (res.error) {
      setDeleting(false);
      setError(
        res.error.message ??
          "Could not delete the account — if you use a password, enter it above.",
      );
      return;
    }
    // gone — session is dead, leave the app
    window.location.href = "/";
  };

  return (
    <section className="border-t border-line pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-danger">
        Danger zone
      </p>
      {!open ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-dim">
            Permanently delete your account, prompts, threads, teams you own,
            and uploaded images.
          </p>
          <button
            className="shrink-0 rounded-full border border-danger/40 px-4 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
            onClick={() => setOpen(true)}
          >
            Delete account
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-danger/30 p-4">
          <p className="text-sm leading-relaxed text-body">
            This is permanent. Everything you saved — prompts, folders,
            threads, projects, bookmarks, usage history, uploaded images —
            is deleted and cannot be recovered. Teams you own are deleted;
            teams you joined lose you as a member.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-dim" htmlFor="del-email">
              Type your email to confirm
            </label>
            <input
              id="del-email"
              className="input"
              placeholder={email}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-dim" htmlFor="del-password">
              Password{" "}
              <span className="font-normal text-dim/80">
                (leave empty if you signed in with Google)
              </span>
            </label>
            <input
              id="del-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              className="btn"
              onClick={() => {
                setOpen(false);
                setConfirmEmail("");
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-danger px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-default disabled:opacity-50"
              disabled={confirmEmail.trim().toLowerCase() !== email.toLowerCase() || deleting}
              onClick={() => void deleteAccount()}
            >
              {deleting ? "Deleting…" : "Delete my account forever"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
