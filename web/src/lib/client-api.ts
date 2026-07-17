"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "shared";

// TanStack Query owns caching/dedupe/stale-while-revalidate (see query.tsx).
// This file is the transport plus one invariant: ANY mutation through api()
// invalidates every query, so post-write reads are always fresh without any
// per-callsite bookkeeping.
let queryClient: QueryClient | null = null;

export function registerQueryClient(qc: QueryClient): void {
  queryClient = qc;
}

/** Same-origin fetch for dashboard pages; cookie session authenticates. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error(`Server error (${res.status})`);
  if (!json.success) throw new Error(json.error ?? `Request failed (${res.status})`);
  if ((init.method ?? "GET") !== "GET") {
    void queryClient?.invalidateQueries();
  }
  return json.data;
}
