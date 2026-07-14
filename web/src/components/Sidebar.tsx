"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Folder } from "shared";
import { api } from "@/lib/client-api";
import { signOut, useSession } from "@/lib/auth-client";

const NAV = [
  { href: "/dashboard/teams", label: "Teams" },
  { href: "/gallery", label: "Public Gallery" },
  { href: "/dashboard/profile", label: "Profile" },
];

// dashboard listens for this to refetch after sidebar folder mutations
export const FOLDERS_CHANGED_EVENT = "pd-folders-changed";
const emitFoldersChanged = () =>
  window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));

export function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const reloadFolders = useCallback(
    () => api<Folder[]>("/api/v1/folders").then(setFolders).catch(() => {}),
    [],
  );

  useEffect(() => {
    if (session) void reloadFolders();
  }, [session, reloadFolders]);

  if (!session) return null;

  const onPrompts = pathname === "/dashboard";
  const activeFolder = onPrompts ? searchParams.get("folder") : null;
  const activeTab = onPrompts ? searchParams.get("tab") : null;

  const newFolder = async () => {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    const folder = await api<Folder>("/api/v1/folders", {
      method: "POST",
      body: { name: name.trim() },
    });
    await reloadFolders();
    emitFoldersChanged();
    router.push(`/dashboard?folder=${folder.id}`);
  };

  const renameFolder = async (f: Folder) => {
    const name = window.prompt("Rename folder", f.name);
    if (!name?.trim() || name.trim() === f.name) return;
    await api(`/api/v1/folders/${f.id}`, {
      method: "PATCH",
      body: { name: name.trim() },
    });
    await reloadFolders();
    emitFoldersChanged();
  };

  const deleteFolder = async (f: Folder) => {
    if (!window.confirm(`Delete folder "${f.name}"? Prompts inside are kept.`)) return;
    await api(`/api/v1/folders/${f.id}`, { method: "DELETE" });
    await reloadFolders();
    emitFoldersChanged();
    if (activeFolder === f.id) router.push("/dashboard");
  };

  const channel = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors ${
      active ? "bg-tint font-semibold text-accent" : "text-dim hover:bg-hover hover:text-ink"
    }`;

  return (
    <>
      {/* mobile: hamburger + backdrop drawer */}
      <button
        className="btn fixed left-3 top-3 z-50 md:hidden"
        aria-label="Menu"
        onClick={() => setMobileOpen((o) => !o)}
      >
        ☰
      </button>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    <aside
      className={`${
        mobileOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"
      } w-56 shrink-0 flex-col border-r border-line bg-raised p-4 md:static md:flex`}
      onClick={() => setMobileOpen(false)}
    >
      <Link href="/" className="mb-6 px-2 font-display text-lg italic">
        Prompt <span className="text-accent">Diary</span>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {/* My Prompts + its folder channels, discord-style */}
        <Link
          href="/dashboard"
          className={`rounded-lg px-3 py-2 text-sm ${
            onPrompts && !activeFolder && !activeTab
              ? "bg-tint font-semibold text-accent"
              : "text-dim hover:bg-hover hover:text-ink"
          }`}
        >
          My Prompts
        </Link>
        <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-line pl-2">
          <Link
            href="/dashboard?tab=pinned"
            className={channel(activeTab === "pinned")}
          >
            <span className="text-xs">★</span> Pinned
          </Link>
          {folders.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard?folder=${f.id}`}
              className={channel(activeFolder === f.id)}
              title={`${f.name} — double-click to rename, right-click to delete`}
              onDoubleClick={(e) => {
                e.preventDefault();
                void renameFolder(f);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                void deleteFolder(f);
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: f.color }}
              />
              <span className="truncate">{f.name}</span>
            </Link>
          ))}
          <button
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-dim transition-colors hover:bg-hover hover:text-accent"
            onClick={() => void newFolder()}
          >
            + New folder
          </button>
        </div>

        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              pathname === item.href
                ? "bg-tint font-semibold text-accent"
                : "text-dim hover:bg-hover hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1 pt-3">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-accent">
            {(session.user.name || session.user.email).charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">
            {session.user.name}
          </span>
          <span className="block truncate text-[11px] text-dim">
            {session.user.email}
          </span>
        </span>
        <button
          className="text-[11px] font-semibold text-dim hover:text-danger"
          title="Sign out"
          onClick={() => void signOut().then(() => router.push("/"))}
        >
          Exit
        </button>
      </div>
    </aside>
    </>
  );
}
