import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teamInvites, teams, user } from "@/db/schema";
import { guard, jsonOk } from "@/lib/api";

// GET /api/v1/invites — pending team invites addressed to my email
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const rows = await db
    .select({
      id: teamInvites.id,
      teamId: teamInvites.teamId,
      teamName: teams.name,
      invitedByName: user.name,
      createdAt: teamInvites.createdAt,
    })
    .from(teamInvites)
    .innerJoin(teams, eq(teamInvites.teamId, teams.id))
    .innerJoin(user, eq(teamInvites.invitedBy, user.id))
    .where(eq(teamInvites.email, g.user.email.toLowerCase()));

  return jsonOk(rows);
}
