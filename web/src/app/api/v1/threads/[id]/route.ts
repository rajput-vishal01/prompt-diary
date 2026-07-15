import { destroyImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { ThreadUpdateSchema } from "shared";
import { db } from "@/db";
import { prompts, threads, threadSteps } from "@/db/schema";
import { guard, jsonErr, jsonOk, notFound } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

async function ownThread(id: string, userId: string) {
  return db.query.threads.findFirst({
    where: and(eq(threads.id, id), eq(threads.userId, userId)),
  });
}

// GET — the recipe: thread + its steps as full prompts, in order
export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const thread = await ownThread(id, g.user.id);
  if (!thread) return notFound();

  const steps = await db
    .select({
      order: threadSteps.order,
      note: threadSteps.note,
      prompt: prompts,
    })
    .from(threadSteps)
    .innerJoin(prompts, eq(threadSteps.promptId, prompts.id))
    .where(eq(threadSteps.threadId, id))
    .orderBy(asc(threadSteps.order));

  return jsonOk({ ...thread, steps });
}

// PATCH — title / project / final output / full step reorder
export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const thread = await ownThread(id, g.user.id);
  if (!thread) return notFound();

  const parsed = ThreadUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);
  const input = parsed.data;

  if (input.promptIds) {
    const mine = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(
        sql`${prompts.id} in ${input.promptIds} and ${prompts.userId} = ${g.user.id}`,
      );
    if (mine.length !== input.promptIds.length) {
      return jsonErr("All steps must be prompts you own", 403);
    }
    // full replace keeps ordering logic trivial — threads have ≤50 steps
    await db.delete(threadSteps).where(eq(threadSteps.threadId, id));
    if (input.promptIds.length) {
      await db.insert(threadSteps).values(
        input.promptIds.map((promptId, i) => ({ threadId: id, promptId, order: i })),
      );
    }
  }

  const [updated] = await db
    .update(threads)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.projectId !== undefined && { projectId: input.projectId }),
      ...(input.finalOutput !== undefined && { finalOutput: input.finalOutput }),
      ...(input.finalImage !== undefined && { finalImage: input.finalImage }),
      updatedAt: new Date(),
    })
    .where(eq(threads.id, id))
    .returning();

  // a replaced/removed final screenshot leaves an orphan on Cloudinary
  if (input.finalImage !== undefined && thread.finalImage && thread.finalImage !== input.finalImage) {
    void destroyImage(thread.finalImage, g.user.id);
  }

  return jsonOk(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const thread = await ownThread(id, g.user.id);
  if (!thread) return notFound();

  // steps cascade; the referenced prompts are untouched
  await db.delete(threads).where(eq(threads.id, id));
  void destroyImage(thread.finalImage, g.user.id); // hard delete → clean the screenshot too
  return jsonOk({ deleted: true });
}
