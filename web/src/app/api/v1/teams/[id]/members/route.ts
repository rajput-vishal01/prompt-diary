import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TeamInviteSchema } from "shared";
import { db } from "@/db";
import { teamInvites, teamMembers, user } from "@/db/schema";
import { forbidden, guard, jsonErr, jsonOk } from "@/lib/api";
import { isTeamMember, isTeamOwner } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET — list members (any member can see)
export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id: teamId } = await params;
  if (!(await isTeamMember(g.user.id, teamId))) return forbidden();

  const members = await db
    .select({
      userId: teamMembers.userId,
      role: teamMembers.role,
      name: user.name,
      email: user.email,
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.userId, user.id))
    .where(eq(teamMembers.teamId, teamId));

  const invites = await db
    .select({ id: teamInvites.id, email: teamInvites.email })
    .from(teamInvites)
    .where(eq(teamInvites.teamId, teamId));

  return jsonOk({ members, invites });
}

// POST { email } — invite (owner only). Existing users join immediately,
// unknown emails become pending invites accepted on their next login.
export async function POST(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id: teamId } = await params;
  if (!(await isTeamOwner(g.user.id, teamId))) return forbidden();

  const parsed = TeamInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);
  const email = parsed.data.email.toLowerCase();

  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) {
    await db
      .insert(teamMembers)
      .values({ teamId, userId: existing.id, role: "member" })
      .onConflictDoNothing();
    return jsonOk({ status: "added" }, 201);
  }

  await db
    .insert(teamInvites)
    .values({ id: crypto.randomUUID(), teamId, email, invitedBy: g.user.id })
    .onConflictDoNothing();
  return jsonOk({ status: "invited" }, 201);
}

const RemoveSchema = z.object({ userId: z.string() });

// DELETE { userId } — owner removes anyone; members can remove themselves (leave)
export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id: teamId } = await params;
  const parsed = RemoveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);
  const targetId = parsed.data.userId;

  const owner = await isTeamOwner(g.user.id, teamId);
  const removingSelf = targetId === g.user.id;
  if (!owner && !removingSelf) return forbidden();
  if (owner && removingSelf) {
    return jsonErr("Owner cannot leave own team; delete the team instead", 400);
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetId)));
  return jsonOk({ removed: true });
}
