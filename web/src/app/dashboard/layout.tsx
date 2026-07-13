"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dim">
        Loading…
      </div>
    );
  }

  return (
    // h-screen + overflow-hidden: the app chrome never scrolls; pages scroll
    // their own content (the prompt list scrolls, not the whole dashboard)
    <div className="flex h-screen overflow-hidden">
      <Suspense>
        <Sidebar />
      </Suspense>
      <main className="min-h-0 flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
