import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { TeamCreateSchema } from "shared";
import { db } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import { guard, jsonErr, jsonOk, needsVerification } from "@/lib/api";

// GET /api/v1/teams — teams I'm a member of
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      ownerId: teams.ownerId,
      createdAt: teams.createdAt,
      role: teamMembers.role,
      memberCount: sql<number>`(select count(*) from ${teamMembers} tm where tm.team_id = ${teams.id})`.mapWith(Number),
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, g.user.id));

  return jsonOk(rows);
}

// POST /api/v1/teams — create team (verified users only), creator becomes owner
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;
  if (!g.user.emailVerified) return needsVerification();

  const parsed = TeamCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  const teamId = crypto.randomUUID();
  const [team] = await db
    .insert(teams)
    .values({ id: teamId, name: parsed.data.name, ownerId: g.user.id })
    .returning();
  await db
    .insert(teamMembers)
    .values({ teamId, userId: g.user.id, role: "owner" });

  return jsonOk(team, 201);
}
