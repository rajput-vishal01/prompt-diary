import { NextRequest } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, usageDays, user } from "@/db/schema";
import { forbidden, guard, jsonOk } from "@/lib/api";
import { isTeamOwner } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET — estimated token spend per member per site, last 30 days (owner only)
export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id: teamId } = await params;
  if (!(await isTeamOwner(g.user.id, teamId))) return forbidden();

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      userId: usageDays.userId,
      name: user.name,
      site: usageDays.site,
      tokens: sql<number>`sum(${usageDays.tokens})::int`,
    })
    .from(usageDays)
    .innerJoin(teamMembers, eq(teamMembers.userId, usageDays.userId))
    .innerJoin(user, eq(user.id, usageDays.userId))
    .where(and(eq(teamMembers.teamId, teamId), gte(usageDays.day, since)))
    .groupBy(usageDays.userId, user.name, usageDays.site)
    .orderBy(sql`sum(${usageDays.tokens}) desc`);

  return jsonOk(rows);
}
