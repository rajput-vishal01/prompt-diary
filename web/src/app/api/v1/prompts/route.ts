import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { PromptCreateSchema } from "shared";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { guard, jsonErr, jsonOk } from "@/lib/api";
import { isTeamMember } from "@/lib/permissions";

// GET /api/v1/prompts?folderId=&q=  — list my prompts
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId");
  const q = searchParams.get("q");

  const conditions = [eq(prompts.userId, g.user.id), eq(prompts.deleted, false)];
  if (folderId) conditions.push(eq(prompts.folderId, folderId));
  if (q) {
    const like = or(ilike(prompts.title, `%${q}%`), ilike(prompts.body, `%${q}%`));
    if (like) conditions.push(like);
  }

  const rows = await db
    .select()
    .from(prompts)
    .where(and(...conditions))
    .orderBy(desc(prompts.updatedAt));

  return jsonOk(rows);
}

// POST /api/v1/prompts — create
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = PromptCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);
  const input = parsed.data;

  if (input.visibility === "team") {
    if (!input.teamId) return jsonErr("teamId required for team visibility", 400);
    if (!(await isTeamMember(g.user.id, input.teamId))) {
      return jsonErr("Not a member of that team", 403);
    }
  }

  const [row] = await db
    .insert(prompts)
    .values({
      id: input.id ?? crypto.randomUUID(),
      userId: g.user.id,
      folderId: input.folderId ?? null,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      visibility: input.visibility ?? "private",
      teamId: input.visibility === "team" ? (input.teamId ?? null) : null,
      pinned: input.pinned ?? false,
    })
    .returning();

  return jsonOk(row, 201);
}
