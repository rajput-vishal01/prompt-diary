import { NextRequest } from "next/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { ProjectCreateSchema } from "shared";
import { db } from "@/db";
import { projects, threads } from "@/db/schema";
import { invalid, guard, jsonOk } from "@/lib/api";

// GET /api/v1/projects — my projects with thread counts
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      color: projects.color,
      teamId: projects.teamId,
      createdAt: projects.createdAt,
      threadCount: sql<number>`count(${threads.id})::int`,
    })
    .from(projects)
    .leftJoin(threads, eq(threads.projectId, projects.id))
    .where(eq(projects.userId, g.user.id))
    .groupBy(projects.id)
    .orderBy(asc(projects.sortOrder), desc(projects.updatedAt));

  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = ProjectCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await db
    .insert(projects)
    .values({
      id: crypto.randomUUID(),
      userId: g.user.id,
      name: parsed.data.name,
      color: parsed.data.color ?? "#777169",
      teamId: parsed.data.teamId ?? null,
    })
    .returning();
  return jsonOk(row, 201);
}
