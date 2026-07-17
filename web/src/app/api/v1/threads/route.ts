import { NextRequest } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ThreadCreateSchema } from "shared";
import { db } from "@/db";
import { prompts, threads, threadSteps } from "@/db/schema";
import { invalid, guard, jsonErr, jsonOk } from "@/lib/api";
import { ownsProject } from "@/lib/permissions";

// GET /api/v1/threads[?projectId=] — my threads with step counts
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const projectId = new URL(req.url).searchParams.get("projectId");
  const rows = await db
    .select({
      id: threads.id,
      title: threads.title,
      projectId: threads.projectId,
      finalOutput: threads.finalOutput,
      finalImage: threads.finalImage,
      createdAt: threads.createdAt,
      updatedAt: threads.updatedAt,
      stepCount: sql<number>`count(${threadSteps.promptId})::int`,
    })
    .from(threads)
    .leftJoin(threadSteps, eq(threadSteps.threadId, threads.id))
    .where(
      projectId
        ? sql`${threads.userId} = ${g.user.id} and ${threads.projectId} = ${projectId}`
        : eq(threads.userId, g.user.id),
    )
    .groupBy(threads.id)
    .orderBy(desc(threads.updatedAt));

  return jsonOk(rows);
}

// POST — create a thread, optionally with initial steps (in order).
// Steps must be prompts the user owns.
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = ThreadCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const { title, projectId, promptIds } = parsed.data;

  if (projectId && !(await ownsProject(g.user.id, projectId))) {
    return jsonErr("Unknown project", 400);
  }

  // dedupe: (threadId, promptId) is the primary key — a duplicate id in the
  // payload would otherwise pass the ownership check and 500 on insert
  const stepIds = [...new Set(promptIds ?? [])];
  if (stepIds.length) {
    const mine = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(inArray(prompts.id, stepIds), eq(prompts.userId, g.user.id)));
    if (mine.length !== stepIds.length) {
      return jsonErr("All steps must be prompts you own", 403);
    }
  }

  const threadId = crypto.randomUUID();
  const [thread] = await db
    .insert(threads)
    .values({
      id: threadId,
      userId: g.user.id,
      projectId: projectId ?? null,
      title,
    })
    .returning();

  if (stepIds.length) {
    await db.insert(threadSteps).values(
      stepIds.map((promptId, i) => ({ threadId, promptId, order: i })),
    );
  }

  return jsonOk({ ...thread, stepCount: stepIds.length }, 201);
}
