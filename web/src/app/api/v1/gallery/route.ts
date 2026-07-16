import { NextRequest } from "next/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { galleryBookmarks, prompts, threads, threadSteps, user } from "@/db/schema";
import { getUser, jsonErr, jsonOk, rateLimit, rateLimitKey } from "@/lib/api";

const PAGE_SIZE = 50;

// GET /api/v1/gallery?q=&page=&sort=copied|new&bookmarked=1&type=threads
// Public ("open source") prompts — and, with type=threads, public recipes.
// No auth required; bookmarked=1 needs a session and filters to your list.
export async function GET(req: NextRequest) {
  const viewer = await getUser(req);
  if (!(await rateLimit(rateLimitKey(req, viewer?.id)))) {
    return jsonErr("Too many requests", 429);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0);
  const sort = searchParams.get("sort") === "new" ? "new" : "copied";

  // ---- public recipes collection ----
  if (searchParams.get("type") === "threads") {
    const conditions = [eq(threads.visibility, "public")];
    if (q) conditions.push(ilike(threads.title, `%${q}%`));

    const rows = await db
      .select({
        id: threads.id,
        title: threads.title,
        finalOutput: threads.finalOutput,
        updatedAt: threads.updatedAt,
        authorName: user.name,
        stepCount: sql<number>`(select count(*) from ${threadSteps} where ${threadSteps.threadId} = ${threads.id})`.mapWith(Number),
      })
      .from(threads)
      .innerJoin(user, eq(threads.userId, user.id))
      .where(and(...conditions))
      .orderBy(desc(threads.updatedAt))
      .limit(PAGE_SIZE)
      .offset(page * PAGE_SIZE);

    // excerpt only — full output lives on /r/[id]
    return jsonOk(
      rows.map((r) => ({ ...r, finalOutput: r.finalOutput?.slice(0, 280) ?? null })),
    );
  }

  // ---- prompts collection ----
  const conditions = [eq(prompts.visibility, "public"), eq(prompts.deleted, false)];
  if (q) {
    const like = or(ilike(prompts.title, `%${q}%`), ilike(prompts.body, `%${q}%`));
    if (like) conditions.push(like);
  }

  if (searchParams.get("bookmarked") === "1") {
    if (!viewer) return jsonOk([]); // signed-out "Bookmarked" view is just empty
    const mine = await db
      .select({ promptId: galleryBookmarks.promptId })
      .from(galleryBookmarks)
      .where(eq(galleryBookmarks.userId, viewer.id));
    if (mine.length === 0) return jsonOk([]);
    conditions.push(inArray(prompts.id, mine.map((r) => r.promptId)));
  }

  const rows = await db
    .select({
      id: prompts.id,
      title: prompts.title,
      body: prompts.body,
      tags: prompts.tags,
      useCount: prompts.useCount,
      createdAt: prompts.createdAt,
      authorName: user.name,
    })
    .from(prompts)
    .innerJoin(user, eq(prompts.userId, user.id))
    .where(and(...conditions))
    .orderBy(
      ...(sort === "new"
        ? [desc(prompts.createdAt)]
        : [desc(prompts.useCount), desc(prompts.createdAt)]),
    )
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  // stamp the viewer's bookmarks so cards can render the filled state
  let bookmarkedIds = new Set<string>();
  if (viewer && rows.length) {
    const marks = await db
      .select({ promptId: galleryBookmarks.promptId })
      .from(galleryBookmarks)
      .where(
        and(
          eq(galleryBookmarks.userId, viewer.id),
          inArray(galleryBookmarks.promptId, rows.map((r) => r.id)),
        ),
      );
    bookmarkedIds = new Set(marks.map((m) => m.promptId));
  }

  return jsonOk(rows.map((r) => ({ ...r, bookmarked: bookmarkedIds.has(r.id) })));
}
