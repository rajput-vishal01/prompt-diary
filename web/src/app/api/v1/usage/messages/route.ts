import { NextRequest } from "next/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { UsageEventsSchema } from "shared";
import { db } from "@/db";
import { usageMessages } from "@/db/schema";
import { invalid, guard, jsonErr, jsonOk } from "@/lib/api";

// reasoning caps run on weekly (168h) windows, so keep 8 days of history
const RETENTION_MS = 8 * 24 * 3_600_000;

// GET /api/v1/usage/messages?site=chatgpt — this user's send timestamps for
// the last 7 days (epoch ms, ascending). The widget computes windows client-side.
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const site = req.nextUrl.searchParams.get("site");
  if (!site) return jsonErr("site required", 400);

  // 7 days back: reasoning caps run on weekly windows, so the widget needs a
  // wider history than the 24h standard bucket to compute them
  const since = new Date(Date.now() - 7 * 24 * 3_600_000);
  const rows = await db
    .select({ at: usageMessages.at, reasoning: usageMessages.reasoning })
    .from(usageMessages)
    .where(
      and(
        eq(usageMessages.userId, g.user.id),
        eq(usageMessages.site, site),
        gte(usageMessages.at, since),
      ),
    )
    .orderBy(asc(usageMessages.at))
    .limit(4000);

  // split into the two buckets the widget tracks independently
  const standard: number[] = [];
  const reasoning: number[] = [];
  for (const r of rows) (r.reasoning ? reasoning : standard).push(r.at.getTime());
  return jsonOk({ standard, reasoning });
}

// POST /api/v1/usage/messages — batch of send events from the extension
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = UsageEventsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const now = Date.now();
  const rows = parsed.data.events
    // reject clock nonsense: events from the future or older than retention
    .filter((e) => e.at <= now + 60_000 && e.at > now - RETENTION_MS)
    .map((e) => ({
      id: crypto.randomUUID(),
      userId: g.user.id,
      site: e.site,
      reasoning: e.reasoning,
      model: e.model,
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
