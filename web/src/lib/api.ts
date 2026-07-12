import { NextRequest, NextResponse } from "next/server";
import { err, ok } from "shared";
import { auth } from "./auth";

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

/** Resolve the current user from cookie session (dashboard) or bearer token (extension). */
export async function getUser(req: NextRequest): Promise<AuthedUser | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  const { id, email, name, emailVerified } = session.user;
  return { id, email, name, emailVerified };
}

export const needsVerification = () =>
  jsonErr("Verify your email address first", 403);

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(ok(data), { status });
}

export function jsonErr(message: string, status: number) {
  return NextResponse.json(err(message), { status });
}

export const unauthorized = () => jsonErr("Unauthorized", 401);
export const forbidden = () => jsonErr("Forbidden", 403);
export const notFound = () => jsonErr("Not found", 404);

// ---------- rate limiting ----------
// ponytail: in-memory sliding window, per server instance. Move to
// Redis/upstash if this ever runs on more than one instance and abuse shows up.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const hits = new Map<string, number[]>();

export function rateLimit(key: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= MAX_REQUESTS) {
    hits.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return true;
}

export function rateLimitKey(req: NextRequest, userId?: string): string {
  return (
    userId ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

/** Standard guard: rate limit + auth. Returns user or an error response. */
export async function guard(
  req: NextRequest,
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const user = await getUser(req);
  if (!rateLimit(rateLimitKey(req, user?.id))) {
    return { response: jsonErr("Too many requests", 429) };
  }
  if (!user) return { response: unauthorized() };
  return { user };
}
