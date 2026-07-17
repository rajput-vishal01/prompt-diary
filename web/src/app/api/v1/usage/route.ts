import { NextRequest } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { UsagePushSchema } from "shared";
import { db } from "@/db";
import { usageDays } from "@/db/schema";
import { invalid, guard, jsonOk } from "@/lib/api";

const dayString = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/v1/usage?days=30 — my estimated token usage, per day/site
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = dayString(new Date(Date.now() - days * 86_400_000));

  const rows = await db
    .select({
      day: usageDays.day,
      site: usageDays.site,
      model: usageDays.model,
      tokens: usageDays.tokens,
    })
    .from(usageDays)
    .where(and(eq(usageDays.userId, g.user.id), gte(usageDays.day, since)))
    .orderBy(usageDays.day);

  return jsonOk(rows);
}

// POST /api/v1/usage — extension pushes DELTAS; server increments per user/day/site
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = UsagePushSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  for (const e of parsed.data.entries) {
    await db
      .insert(usageDays)
      .values({ userId: g.user.id, day: e.day, site: e.site, model: e.model, tokens: e.tokens })
      .onConflictDoUpdate({
        target: [usageDays.userId, usageDays.day, usageDays.site, usageDays.model],
        set: { tokens: sql`${usageDays.tokens} + ${e.tokens}` },
      });
  }
  return jsonOk({ recorded: parsed.data.entries.length });
}
