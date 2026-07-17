"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api, registerQueryClient } from "./client-api";

// One QueryClient per browser session. staleTime keeps revisits instant
// (cached render first, background refetch after 30s of staleness);
// refetchOnWindowFocus keeps long-lived tabs honest for free.
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const c = makeClient();
    registerQueryClient(c); // lets client-api invalidate after any mutation
    return c;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The app's one data hook: the /api/v1 path IS the cache key. */
export function useApi<T>(
  path: string,
  opts: { enabled?: boolean } = {},
): UseQueryResult<T> {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => api<T>(path),
    enabled: opts.enabled,
  });
}
