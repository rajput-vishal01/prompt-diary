import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prompts, teams } from "@/db/schema";
import { forbidden, guard, jsonErr, jsonOk, notFound } from "@/lib/api";
import { isTeamOwner } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

const TeamPatchSchema = z.object({ name: z.string().min(1).max(100) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  if (!(await isTeamOwner(g.user.id, id))) return forbidden();

  const parsed = TeamPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  const [updated] = await db
    .update(teams)
    .set({ name: parsed.data.name })
    .where(eq(teams.id, id))
    .returning();
  if (!updated) return notFound();
  return jsonOk(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  if (!(await isTeamOwner(g.user.id, id))) return forbidden();

  // demote team prompts to private so nothing dangles semi-shared
  await db
    .update(prompts)
    .set({ visibility: "private", teamId: null, updatedAt: new Date() })
    .where(eq(prompts.teamId, id));
  await db.delete(teams).where(eq(teams.id, id));
  return jsonOk({ deleted: true });
}
