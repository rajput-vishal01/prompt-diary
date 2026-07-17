"use client";

import type { ApiResponse } from "shared";

// SWR-lite over the /api/v1 surface. GETs are cached in-memory and served
// instantly on revisit (a background revalidation refreshes the entry for the
// NEXT read), concurrent GETs of the same path are deduped (the sidebar and a
// page asking for /folders together used to be two identical requests), and
// ANY mutation clears the whole cache so the next read of anything is fresh.
// This is what makes dashboard navigation feel instant instead of
// skeleton → refetch on every single visit.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function fetchJson<T>(
  path: string,
  init: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error(`Server error (${res.status})`);
  if (!json.success) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data;
}

function revalidate(path: string): void {
  if (inflight.has(path)) return;
  const p = fetchJson<unknown>(path, {})
    .then((data) => {
      cache.set(path, { at: Date.now(), data });
      inflight.delete(path);
      return data;
    })
    .catch(() => {
      inflight.delete(path);
      cache.delete(path); // a failing endpoint must not keep serving stale
    });
  inflight.set(path, p);
}

/** Same-origin fetch for dashboard pages; cookie session authenticates. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? "GET";

  if (method !== "GET") {
    cache.clear(); // mutations invalidate everything — cheap and always correct
    return fetchJson<T>(path, init);
  }

  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) {
    revalidate(path); // stale-while-revalidate: instant now, fresh next read
    return hit.data as T;
  }

  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;

  const p = fetchJson<T>(path, init)
    .then((data) => {
      cache.set(path, { at: Date.now(), data });
      inflight.delete(path);
      return data;
    })
    .catch((e: unknown) => {
      inflight.delete(path);
      throw e;
    });
  inflight.set(path, p);
  return p;
}
