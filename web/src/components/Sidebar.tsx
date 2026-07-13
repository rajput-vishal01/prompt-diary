"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

const NAV = [
  { href: "/dashboard", label: "My Prompts" },
  { href: "/dashboard/teams", label: "Teams" },
  { href: "/gallery", label: "Public Gallery" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  if (!session) return null;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-raised p-4">
      <Link href="/" className="mb-6 px-2 font-display text-lg italic">
        Prompt <span className="text-accent">Diary</span>
      </Link>
      <nav className="flex flex-col gap-1">
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
      <div className="mt-auto space-y-2 px-2">
        <p className="truncate text-xs text-dim">{session.user.email}</p>
        <button
          className="text-sm text-accent hover:underline"
          onClick={() => void signOut().then(() => router.push("/"))}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
