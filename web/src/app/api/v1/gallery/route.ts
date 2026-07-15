import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { prompts, user } from "@/db/schema";
import { jsonErr, jsonOk, rateLimit, rateLimitKey } from "@/lib/api";

const PAGE_SIZE = 50;

// GET /api/v1/gallery?q=&page= — public ("open source") prompts. No auth.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(rateLimitKey(req)))) return jsonErr("Too many requests", 429);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0);

  const conditions = [eq(prompts.visibility, "public"), eq(prompts.deleted, false)];
  if (q) {
    const like = or(ilike(prompts.title, `%${q}%`), ilike(prompts.body, `%${q}%`));
    if (like) conditions.push(like);
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
    .orderBy(desc(prompts.useCount), desc(prompts.createdAt))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  return jsonOk(rows);
}
