"use client";

import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";

// The client chrome of the dashboard. Auth already happened SERVER-side in
// the layout (getSession + redirect), so this renders content immediately —
// no BrandLoading gate blocking every hard load on a client session fetch.
export function DashboardShell({ children }: { children: React.ReactNode }) {
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
