"use client";

import type { ApiResponse } from "shared";

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
  return json.data;
}
