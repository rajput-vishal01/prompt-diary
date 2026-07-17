import "server-only";

import { headers } from "next/headers";
import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";

// Server-side warm-up for the client QueryClient: fetch the given /api/v1
// paths DURING SSR (self-fetch with the caller's cookies) and dehydrate them,
// so a hard load paints with data instead of skeletons. Query keys match
// useApi's convention (the path string), and hydrated entries carry a fresh
// dataUpdatedAt so the client won't immediately refetch.
export async function prefetchApi(paths: string[]): Promise<DehydratedState> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";

  const qc = new QueryClient();
  await Promise.all(
    paths.map((path) =>
      qc.prefetchQuery({
        queryKey: [path],
        queryFn: async () => {
          const res = await fetch(`${proto}://${host}${path}`, {
            headers: { cookie },
            cache: "no-store",
          });
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: unknown;
          } | null;
          if (!json?.success) throw new Error(`prefetch ${path} failed (${res.status})`);
          return json.data;
        },
      }),
    ),
  );
  return dehydrate(qc);
}
