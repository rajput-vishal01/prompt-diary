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
