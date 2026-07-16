import { NextRequest } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, usageDays, user } from "@/db/schema";
import { forbidden, guard, jsonErr, jsonOk } from "@/lib/api";
import { hasActivePlan } from "@/lib/billing";
import { isTeamOwner } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET — estimated token spend per member per site, last 30 days (owner only).
// Team analytics is a paid feature when billing is configured; with billing
// off (dev/self-hosted) hasActivePlan is always true.
// ?granularity=day returns per-day rows (member × site × day) for the usage
// dashboard chart; default stays the 30-day aggregate the team page renders.
export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id: teamId } = await params;
  if (!(await isTeamOwner(g.user.id, teamId))) return forbidden();
  if (!(await hasActivePlan(g.user.id))) {
    return jsonErr("Team usage analytics requires a Pro plan", 402);
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const daily = new URL(req.url).searchParams.get("granularity") === "day";

  const rows = await db
    .select({
      userId: usageDays.userId,
      name: user.name,
      site: usageDays.site,
      model: usageDays.model,
      ...(daily && { day: usageDays.day }),
      tokens: sql<number>`sum(${usageDays.tokens})::int`,
    })
    .from(usageDays)
    .innerJoin(teamMembers, eq(teamMembers.userId, usageDays.userId))
    .innerJoin(user, eq(user.id, usageDays.userId))
    .where(and(eq(teamMembers.teamId, teamId), gte(usageDays.day, since)))
    .groupBy(
      usageDays.userId,
      user.name,
      usageDays.site,
      usageDays.model,
      ...(daily ? [usageDays.day] : []),
    )
    .orderBy(sql`sum(${usageDays.tokens}) desc`);

  return jsonOk(rows);
}
