import type { ApiResponse } from "shared";

// Default API host — set VITE_API_URL at build time for the store build
// (see README "Deploying"). Can still be overridden per-install by setting
// { apiUrl } in chrome.storage.local.
const DEFAULT_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

export interface AuthState {
  token: string;
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

async function authHeaders(): Promise<Record<string, string>> {
  const auth = await getAuth();
  return {
    "Content-Type": "application/json",
    ...(auth && { Authorization: `Bearer ${auth.token}` }),
  };
}

/** Call a /api/v1 endpoint; unwraps the {success,data,error} envelope. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const base = await getApiUrl();
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: await authHeaders(),
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error(`Server error (${res.status})`);
  if (!json.success) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data;
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
    throw new Error(detail?.message ?? `Sign in failed (${res.status})`);
  }
  const token = res.headers.get("set-auth-token");
  if (!token) throw new Error("No session token returned");
  const json = (await res.json()) as AuthUserResponse;
  const auth: AuthState = {
    token,
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
  await setAuth(null);
}
