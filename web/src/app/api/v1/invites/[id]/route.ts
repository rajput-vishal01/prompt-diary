import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { teamInvites, teamMembers } from "@/db/schema";
import { invalid, guard, jsonOk, needsVerification, notFound } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const ActionSchema = z.object({ action: z.enum(["accept", "decline"]) });

// POST /api/v1/invites/:id { action } — accept or decline an invite to me
export async function POST(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const invite = await db.query.teamInvites.findFirst({
    where: eq(teamInvites.id, id),
  });
  // only the addressee can act on an invite
  if (!invite || invite.email !== g.user.email.toLowerCase()) return notFound();

  if (parsed.data.action === "accept") {
    if (!g.user.emailVerified) return needsVerification();
    await db
      .insert(teamMembers)
      .values({ teamId: invite.teamId, userId: g.user.id, role: "member" })
      .onConflictDoNothing();
  }
  await db.delete(teamInvites).where(eq(teamInvites.id, id));

  return jsonOk({ status: parsed.data.action === "accept" ? "joined" : "declined" });
}
