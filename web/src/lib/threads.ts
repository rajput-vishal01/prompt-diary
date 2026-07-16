import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, threads, threadSteps } from "@/db/schema";
import { canAccessPrompt, canReadThread } from "@/lib/permissions";

/**
 * Thread + steps with per-step redaction for the given (nullable) viewer.
 * Returns null when the thread doesn't exist OR the viewer can't read it —
 * private threads read as missing.
 */
export async function loadThreadForViewer(id: string, userId: string | null) {
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, id) });
  if (!thread || !canReadThread(userId, thread)) return null;

  const rows = await db
    .select({
      order: threadSteps.order,
      note: threadSteps.note,
      prompt: prompts,
    })
    .from(threadSteps)
    .innerJoin(prompts, eq(threadSteps.promptId, prompts.id))
    .where(eq(threadSteps.threadId, id))
    .orderBy(asc(threadSteps.order));

  // a public recipe may chain private prompts — show those steps as
  // title-only so the recipe's shape is visible without leaking bodies
  const steps = await Promise.all(
    rows.map(async (s) => {
      if (await canAccessPrompt(userId, s.prompt, "read")) {
        return { ...s, redacted: false };
      }
      return {
        order: s.order,
        note: null,
        prompt: { id: s.prompt.id, title: s.prompt.title, tags: [] as string[] },
        redacted: true,
      };
    }),
  );

  return { ...thread, steps };
}

export type ThreadForViewer = NonNullable<Awaited<ReturnType<typeof loadThreadForViewer>>>;
