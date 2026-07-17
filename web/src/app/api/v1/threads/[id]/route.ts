import { destroyImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { ThreadUpdateSchema } from "shared";
import { db } from "@/db";
import { prompts, threads, threadSteps } from "@/db/schema";
import { invalid,
  getUser,
  guard,
  jsonErr,
  jsonOk,
  needsVerification,
  notFound,
  rateLimit,
  rateLimitKey,
} from "@/lib/api";
import { ownsProject } from "@/lib/permissions";
import { loadThreadForViewer } from "@/lib/threads";

type Params = { params: Promise<{ id: string }> };

async function ownThread(id: string, userId: string) {
  return db.query.threads.findFirst({
    where: and(eq(threads.id, id), eq(threads.userId, userId)),
  });
}

// GET — the recipe: thread + its steps as full prompts, in order.
// Anonymous allowed: public threads are world-readable (/r/[id] share pages).
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req);
  if (!(await rateLimit(rateLimitKey(req, user?.id)))) {
    return jsonErr("Too many requests", 429);
  }

  const { id } = await params;
  const result = await loadThreadForViewer(id, user?.id ?? null);
  if (!result) return notFound(); // private + not yours reads as missing
  return jsonOk(result);
}

// PATCH — title / project / final output / full step reorder
export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const thread = await ownThread(id, g.user.id);
  if (!thread) return notFound();

  const parsed = ThreadUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  // publishing a recipe = publishing content, same gate as prompts
  if (
    input.visibility === "public" &&
    thread.visibility !== "public" &&
    !g.user.emailVerified
  ) {
    return needsVerification();
  }

  // moving the thread into a project requires owning that project
  if (input.projectId && !(await ownsProject(g.user.id, input.projectId))) {
    return jsonErr("Unknown project", 400);
  }

  if (input.promptIds) {
    // dedupe: (threadId, promptId) is the primary key
    const stepIds = [...new Set(input.promptIds)];
    if (stepIds.length) {
      const mine = await db
        .select({ id: prompts.id })
        .from(prompts)
        .where(and(inArray(prompts.id, stepIds), eq(prompts.userId, g.user.id)));
      if (mine.length !== stepIds.length) {
        return jsonErr("All steps must be prompts you own", 403);
      }
    }
    // full replace keeps ordering logic trivial — threads have ≤50 steps
    await db.delete(threadSteps).where(eq(threadSteps.threadId, id));
    if (stepIds.length) {
      await db.insert(threadSteps).values(
        stepIds.map((promptId, i) => ({ threadId: id, promptId, order: i })),
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
      ...(input.visibility !== undefined && { visibility: input.visibility }),
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
