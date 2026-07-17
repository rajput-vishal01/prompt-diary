import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { getUser, jsonErr, jsonOk, notFound, rateLimit, rateLimitKey } from "@/lib/api";

// POST { promptId } — a visitor copied a public prompt (gallery card, gallery
// detail, /p/[id] share page). This is what makes "most copied" mean copies by
// the community, not just the author: useCount writes via PATCH are owner-only.
// Anonymous allowed; the shared rate limit caps abuse per IP/user.
// ponytail: rate limit is the only inflation guard; add per-viewer dedupe if
// gallery ranking ever starts getting gamed.
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!(await rateLimit(rateLimitKey(req, user?.id)))) {
    return jsonErr("Too many requests", 429);
  }

  const body = (await req.json().catch(() => null)) as { promptId?: string } | null;
  const promptId = body?.promptId;
  if (!promptId || typeof promptId !== "string") return jsonErr("promptId required", 400);

  const [row] = await db
    .update(prompts)
    .set({ useCount: sql`${prompts.useCount} + 1` }) // no updatedAt bump — a copy is not an edit (LWW)
    .where(
      and(
        eq(prompts.id, promptId),
        eq(prompts.visibility, "public"),
        eq(prompts.deleted, false),
      ),
    )
    .returning({ useCount: prompts.useCount });

  if (!row) return notFound(); // private/deleted/unknown — nothing to count
  return jsonOk({ counted: true });
}
