"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { BrandLoading } from "@/components/StatusScreen";

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

  // this session check gates EVERY hard load of the dashboard — it must show
  // the designed loading surface, not bare text (which used to sit on screen
  // masking loading.tsx for the whole check)
  if (isPending || !session) return <BrandLoading />;

  return (
    // h-screen + overflow-hidden: the app chrome never scrolls; pages scroll
    // their own content (the prompt list scrolls, not the whole dashboard)
    <div className="flex h-screen overflow-hidden">
      <Suspense>
        <Sidebar />
      </Suspense>
      {/* content sits in a comfortable centered column, not edge-to-edge */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto h-full max-w-[1040px] px-6 py-6 text-[15px] md:px-12 md:py-8">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
