import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { ZodError } from "zod";
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

/** 400 with the first Zod issue as readable text — never the raw issue-list JSON. */
export function invalid(error: ZodError) {
  const i = error.issues[0];
  const msg = i ? (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message) : "Invalid input";
  return jsonErr(msg, 400);
}

export const unauthorized = () => jsonErr("Unauthorized", 401);
export const forbidden = () => jsonErr("Forbidden", 403);
export const notFound = () => jsonErr("Not found", 404);

// ---------- rate limiting ----------
// Upstash Redis when configured (multi-instance safe — required in prod once
// share links / API keys make anonymous traffic real); in-memory sliding
// window otherwise so dev/local needs zero setup.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const hits = new Map<string, number[]>();

const upstash =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, "60 s"),
        prefix: "pd-rl",
      })
    : null;

export async function rateLimit(key: string): Promise<boolean> {
  if (upstash) {
    try {
      const { success } = await upstash.limit(key);
      return success;
    } catch {
      return true; // Redis hiccup must not take the API down — fail open
    }
  }
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
  if (!(await rateLimit(rateLimitKey(req, user?.id)))) {
    return { response: jsonErr("Too many requests", 429) };
  }
  if (!user) return { response: unauthorized() };
  return { user };
}
