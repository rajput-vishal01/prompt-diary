import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { galleryBookmarks, prompts } from "@/db/schema";
import { guard, jsonErr, jsonOk, notFound } from "@/lib/api";

// GET — the ids I've bookmarked (newest first); the gallery UI joins client-side
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const rows = await db
    .select({ promptId: galleryBookmarks.promptId })
    .from(galleryBookmarks)
    .where(eq(galleryBookmarks.userId, g.user.id))
    .orderBy(desc(galleryBookmarks.createdAt));

  return jsonOk(rows.map((r) => r.promptId));
}

// POST {promptId} — bookmark a public gallery prompt (idempotent)
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => null)) as { promptId?: string } | null;
  const promptId = body?.promptId;
  if (!promptId || typeof promptId !== "string") return jsonErr("promptId required", 400);

  const prompt = await db.query.prompts.findFirst({ where: eq(prompts.id, promptId) });
  if (!prompt || prompt.deleted || prompt.visibility !== "public") return notFound();

  await db
    .insert(galleryBookmarks)
    .values({ userId: g.user.id, promptId })
    .onConflictDoNothing();

  return jsonOk({ bookmarked: true });
}

// DELETE ?promptId= — remove a bookmark (idempotent)
export async function DELETE(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const promptId = new URL(req.url).searchParams.get("promptId");
  if (!promptId) return jsonErr("promptId required", 400);

  await db
    .delete(galleryBookmarks)
    .where(
      and(eq(galleryBookmarks.userId, g.user.id), eq(galleryBookmarks.promptId, promptId)),
    );

  return jsonOk({ bookmarked: false });
}
