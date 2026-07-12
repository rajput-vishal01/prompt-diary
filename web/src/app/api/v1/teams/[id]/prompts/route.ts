import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, user } from "@/db/schema";
import { forbidden, guard, jsonOk } from "@/lib/api";
import { isTeamMember } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET — team prompt library (members only)
export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id: teamId } = await params;
  if (!(await isTeamMember(g.user.id, teamId))) return forbidden();

  const rows = await db
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      tags: prompts.tags,
      useCount: prompts.useCount,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      authorName: user.name,
    })
    .from(prompts)
    .innerJoin(user, eq(prompts.userId, user.id))
    .where(
      and(
        eq(prompts.teamId, teamId),
        eq(prompts.visibility, "team"),
        eq(prompts.deleted, false),
      ),
    )
    .orderBy(desc(prompts.updatedAt));

  return jsonOk(rows);
}
