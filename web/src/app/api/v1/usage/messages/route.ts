import { NextRequest } from "next/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { UsageEventsSchema } from "shared";
import { db } from "@/db";
import { usageMessages } from "@/db/schema";
import { guard, jsonErr, jsonOk } from "@/lib/api";

const RETENTION_MS = 48 * 3_600_000; // longest site window is 24h — keep 2×

// GET /api/v1/usage/messages?site=chatgpt — this user's send timestamps in
// the last 24h (epoch ms, ascending). The widget computes windows client-side.
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const site = req.nextUrl.searchParams.get("site");
  if (!site) return jsonErr("site required", 400);

  const since = new Date(Date.now() - 24 * 3_600_000);
  const rows = await db
    .select({ at: usageMessages.at })
    .from(usageMessages)
    .where(
      and(
        eq(usageMessages.userId, g.user.id),
        eq(usageMessages.site, site),
        gte(usageMessages.at, since),
      ),
    )
    .orderBy(asc(usageMessages.at))
    .limit(2000);

  return jsonOk(rows.map((r) => r.at.getTime()));
}

// POST /api/v1/usage/messages — batch of send events from the extension
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = UsageEventsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  const now = Date.now();
  const rows = parsed.data.events
    // reject clock nonsense: events from the future or older than retention
    .filter((e) => e.at <= now + 60_000 && e.at > now - RETENTION_MS)
    .map((e) => ({
      id: crypto.randomUUID(),
      userId: g.user.id,
      site: e.site,
      at: new Date(e.at),
    }));

  if (rows.length) await db.insert(usageMessages).values(rows);

  // opportunistic self-pruning keeps the table bounded per user
  await db
    .delete(usageMessages)
    .where(
      and(eq(usageMessages.userId, g.user.id), lt(usageMessages.at, new Date(now - RETENTION_MS))),
    );

  return jsonOk({ recorded: rows.length });
}
