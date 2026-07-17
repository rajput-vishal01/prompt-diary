import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { auth } from "@/lib/auth";
import { prefetchApi } from "@/lib/server-prefetch";
import { DashboardShell } from "@/components/DashboardShell";

// Server-side session gate: the check runs during SSR (cookieCache makes it
// ~free), so a dead session redirects before any HTML ships and a live one
// renders content on first paint — the old client-side gate blocked EVERY
// hard load behind a BrandLoading screen while useSession round-tripped.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // warm the shared queries during SSR: the sidebar AND the list pages
  // (My Prompts, Projects, Teams) all read from these five, so a hard load
  // paints the whole dashboard with data — zero skeletons
  const state = await prefetchApi([
    "/api/v1/prompts",
    "/api/v1/folders",
    "/api/v1/projects",
    "/api/v1/threads",
    "/api/v1/teams",
  ]);

  return (
    <HydrationBoundary state={state}>
      <DashboardShell>{children}</DashboardShell>
    </HydrationBoundary>
  );
}
