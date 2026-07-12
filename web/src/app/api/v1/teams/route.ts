import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { TeamCreateSchema } from "shared";
import { db } from "@/db";
import { teamInvites, teamMembers, teams } from "@/db/schema";
import { guard, jsonErr, jsonOk } from "@/lib/api";

// GET /api/v1/teams — my teams (also auto-accepts pending email invites)
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  // auto-accept: any pending invites for my email become memberships
  const pending = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.email, g.user.email));
  for (const invite of pending) {
    await db
      .insert(teamMembers)
      .values({ teamId: invite.teamId, userId: g.user.id, role: "member" })
      .onConflictDoNothing();
    await db.delete(teamInvites).where(eq(teamInvites.id, invite.id));
  }

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      ownerId: teams.ownerId,
      createdAt: teams.createdAt,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, g.user.id));

  return jsonOk(rows);
}

// POST /api/v1/teams — create team, creator becomes owner
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

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
