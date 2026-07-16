import type { ApiResponse } from "shared";

// Default API host — set VITE_API_URL at build time for the store build
// (see README "Deploying"). Can still be overridden per-install by setting
// { apiUrl } in chrome.storage.local.
const DEFAULT_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

export interface AuthState {
  token: string; // empty in cookie mode
  mode?: "bearer" | "cookie"; // cookie = riding the web session (google sign-in)
  email: string;
  name: string;
}

export async function getApiUrl(): Promise<string> {
  const res = await chrome.storage.local.get("apiUrl");
  return (res["apiUrl"] as string | undefined) ?? DEFAULT_API_URL;
}

export async function getAuth(): Promise<AuthState | null> {
  const res = await chrome.storage.local.get("auth");
  return (res["auth"] as AuthState | undefined) ?? null;
}

export async function setAuth(auth: AuthState | null): Promise<void> {
  if (auth) await chrome.storage.local.set({ auth });
  else await chrome.storage.local.remove("auth");
}

/** Call a /api/v1 endpoint; unwraps the {success,data,error} envelope. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const base = await getApiUrl();
  const auth = await getAuth();
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(auth?.token && { Authorization: `Bearer ${auth.token}` }),
    },
    credentials: auth?.mode === "cookie" ? "include" : "omit",
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error("Something went wrong — try again");
  if (!json.success) throw new Error(json.error ?? "Something went wrong — try again");
  return json.data;
}

/**
 * Detect an existing web session (any sign-in method, incl. Google) and
 * adopt it. Called on popup open when signed out, and by the Google button.
 */
export async function tryCookieSession(): Promise<AuthState | null> {
  const optOut = await chrome.storage.local.get("cookieOptOut");
  if (optOut["cookieOptOut"]) return null;
  try {
    const base = await getApiUrl();
    const res = await fetch(`${base}/api/auth/get-session`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      user?: { email: string; name: string };
    } | null;
    if (!json?.user) return null;
    const auth: AuthState = {
      token: "",
      mode: "cookie",
      email: json.user.email,
      name: json.user.name,
    };
    await setAuth(auth);
    return auth;
  } catch {
    return null;
  }
}

/** Google (or any web) sign-in: open the web login; popup adopts the session next open. */
export async function openWebSignIn(): Promise<void> {
  await chrome.storage.local.remove("cookieOptOut");
  const base = await getApiUrl();
  await chrome.tabs.create({ url: `${base}/login` });
}

// ---- Better Auth email/password (bearer plugin returns set-auth-token) ----

interface AuthUserResponse {
  user?: { email: string; name: string };
}

async function authRequest(
  path: string,
  body: Record<string, string>,
): Promise<AuthState> {
  const base = await getApiUrl();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { message?: string } | null;
    // never surface raw status codes to the user
    const friendly =
      res.status >= 500
        ? "Something went wrong on our end — try again"
        : "Wrong email or password";
    throw new Error(detail?.message ?? friendly);
  }
  const token = res.headers.get("set-auth-token");
  if (!token) throw new Error("Sign-in didn't complete — try again");
  const json = (await res.json()) as AuthUserResponse;
  const auth: AuthState = {
    token,
    mode: "bearer",
    email: json.user?.email ?? body["email"] ?? "",
    name: json.user?.name ?? body["name"] ?? "",
  };
  await setAuth(auth);
  return auth;
}

export interface TeamRow {
  id: string;
  name: string;
  role: "owner" | "member";
}

export function getTeams(): Promise<TeamRow[]> {
  return api<TeamRow[]>("/api/v1/teams");
}

// ---- thread recording (forward capture) ----

export interface ThreadRef {
  id: string;
  title: string;
}

export function getThreads(): Promise<ThreadRef[]> {
  return api<Array<ThreadRef & { stepCount: number }>>("/api/v1/threads");
}

export function createThread(title: string): Promise<ThreadRef> {
  return api<ThreadRef>("/api/v1/threads", { method: "POST", body: { title } });
}

export function createProject(name: string): Promise<{ id: string; name: string }> {
  return api<{ id: string; name: string }>("/api/v1/projects", {
    method: "POST",
    body: { name },
  });
}

export async function getActiveThread(): Promise<ThreadRef | null> {
  const res = await chrome.storage.local.get("activeThread");
  return (res["activeThread"] as ThreadRef | undefined) ?? null;
}

export async function setActiveThread(t: ThreadRef | null): Promise<void> {
  if (t) await chrome.storage.local.set({ activeThread: t });
  else await chrome.storage.local.remove("activeThread");
}

// steps queued while offline/unsynced — flushed after each successful sync
export async function queueThreadStep(threadId: string, promptId: string): Promise<void> {
  const res = await chrome.storage.local.get("pendingSteps");
  const q = (res["pendingSteps"] as Array<{ threadId: string; promptId: string }>) ?? [];
  q.push({ threadId, promptId });
  await chrome.storage.local.set({ pendingSteps: q });
}

export function signIn(email: string, password: string): Promise<AuthState> {
  return authRequest("/api/auth/sign-in/email", { email, password });
}

export function signUp(
  name: string,
  email: string,
  password: string,
): Promise<AuthState> {
  return authRequest("/api/auth/sign-up/email", { name, email, password });
}

export async function signOut(): Promise<void> {
  const auth = await getAuth();
  await setAuth(null);
  if (auth?.mode === "cookie") {
    // don't auto-adopt the web session again until they ask
    await chrome.storage.local.set({ cookieOptOut: true });
  }
}

// ---------- usage-limit tracker events ----------
// Send events are recorded by the background worker. They ALWAYS land in the
// local log (works signed-out and offline) and, when signed in, queue for the
// server so counts survive refreshes/reinstalls and follow the user across
// devices. Server is the source of truth when reachable.

export interface UsageEvent {
  site: string;
  at: number; // epoch ms
  reasoning: boolean; // thinking-mode send — its own bucket
  model: string; // detected model label ("" = unknown)
}

/** Send timestamps split into the two independently-capped buckets. */
export interface UsageBuckets {
  standard: number[];
  reasoning: number[];
}

const DAY_MS = 24 * 3_600_000;
const WEEK_MS = 7 * DAY_MS; // reasoning caps are weekly — keep a week locally

type LocalLog = Record<string, UsageBuckets>;

// tolerate the pre-bucket shape (Record<site, number[]>) so an in-place
// extension update doesn't throw on the old stored log
function normalizeLog(raw: unknown): LocalLog {
  const out: LocalLog = {};
  if (raw && typeof raw === "object") {
    for (const [site, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) out[site] = { standard: v as number[], reasoning: [] };
      else if (v && typeof v === "object") {
        const o = v as Partial<UsageBuckets>;
        out[site] = { standard: o.standard ?? [], reasoning: o.reasoning ?? [] };
      }
    }
  }
  return out;
}

/** Record one send event: bucketed local log + server queue. */
export async function recordUsageEvent(
  site: string,
  opts: { at?: number; reasoning?: boolean; model?: string } = {},
): Promise<void> {
  const at = opts.at ?? Date.now();
  const reasoning = opts.reasoning ?? false;
  const model = opts.model ?? "";
  const res = await chrome.storage.local.get(["usageLocalLog", "usageEvents"]);
  const log = normalizeLog(res["usageLocalLog"]);
  const b = log[site] ?? { standard: [], reasoning: [] };
  const kept = (reasoning ? b.reasoning : b.standard).filter((t) => t > at - WEEK_MS);
  if (reasoning) b.reasoning = [...kept, at];
  else b.standard = [...kept, at];
  log[site] = b;
  const queue = (res["usageEvents"] as UsageEvent[] | undefined) ?? [];
  queue.push({ site, at, reasoning, model });
  await chrome.storage.local.set({ usageLocalLog: log, usageEvents: queue.slice(-500) });
}

// re-entrancy guard: flushUsageEvents fires after every tracked send AND on
// every popup sync. Without this, two overlapping calls POST the same batch
// and mis-trim the queue. (Guards within a realm; the rarer cross-realm
// overlap is bounded by identity-based removal below + 48h server prune.)
let usageFlushInFlight = false;

/** Push queued events to the server (no-op signed out; retries next call). */
export async function flushUsageEvents(): Promise<void> {
  if (usageFlushInFlight) return;
  usageFlushInFlight = true;
  try {
    const auth = await getAuth();
    if (!auth) return;
    const res = await chrome.storage.local.get("usageEvents");
    const queue = (res["usageEvents"] as UsageEvent[] | undefined) ?? [];
    if (queue.length === 0) return;
    const batch = queue.slice(0, 100);
    await api("/api/v1/usage/messages", { method: "POST", body: { events: batch } });
    // remove exactly the events we sent by identity, not by count — a naive
    // slice(batch.length) over a re-read queue can drop events appended mid-flush
    const sent = new Set(batch.map((e) => `${e.site}|${e.at}`));
    let removed = 0;
    const latest = await chrome.storage.local.get("usageEvents");
    const current = (latest["usageEvents"] as UsageEvent[] | undefined) ?? [];
    const remaining = current.filter((e) => {
      if (removed < batch.length && sent.has(`${e.site}|${e.at}`)) {
        removed++;
        return false;
      }
      return true;
    });
    await chrome.storage.local.set({ usageEvents: remaining.slice(-500) });
  } catch {
    // keep the queue; next event or sync retries
  } finally {
    usageFlushInFlight = false;
  }
}

/** Bucketed send timestamps: server (authoritative) ∪ unflushed queue, or the local log. */
export async function getUsageTimestamps(site: string): Promise<UsageBuckets> {
  const auth = await getAuth();
  const res = await chrome.storage.local.get(["usageLocalLog", "usageEvents"]);
  const queue = ((res["usageEvents"] as UsageEvent[] | undefined) ?? []).filter((e) => e.site === site);
  const qStd = queue.filter((e) => !e.reasoning).map((e) => e.at);
  const qRsn = queue.filter((e) => e.reasoning).map((e) => e.at);
  if (auth) {
    try {
      const server = await api<UsageBuckets>(`/api/v1/usage/messages?site=${encodeURIComponent(site)}`);
      return {
        standard: [...server.standard, ...qStd].sort((a, b) => a - b),
        reasoning: [...server.reasoning, ...qRsn].sort((a, b) => a - b),
      };
    } catch {
      // fall through to local
    }
  }
  const b = normalizeLog(res["usageLocalLog"])[site] ?? { standard: [], reasoning: [] };
  return {
    standard: [...b.standard].sort((a, b) => a - b),
    reasoning: [...b.reasoning].sort((a, b) => a - b),
  };
}
