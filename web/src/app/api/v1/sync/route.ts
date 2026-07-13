import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { SyncPushSchema } from "shared";
import { db } from "@/db";
import { folders, prompts } from "@/db/schema";
import { guard, jsonErr, jsonOk } from "@/lib/api";
import { isTeamMember } from "@/lib/permissions";

// POST /api/v1/sync — offline-first reconciliation.
// Client pushes local changes; server merges with last-write-wins on
// updatedAt, then returns the full authoritative snapshot.
// ponytail: full-snapshot pull each sync; switch to delta sync if vaults get huge.
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;
  const userId = g.user.id;

  const parsed = SyncPushSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);
  const push = parsed.data;

  // ---- folders ----
  for (const f of push.folders) {
    const existing = await db.query.folders.findFirst({
      where: eq(folders.id, f.id),
    });
    if (existing && existing.userId !== userId) continue; // not yours: skip
    if (existing) {
      await db
        .update(folders)
        .set({ name: f.name, color: f.color ?? existing.color, updatedAt: new Date() })
        .where(eq(folders.id, f.id));
    } else {
      await db.insert(folders).values({
        id: f.id,
        userId,
        name: f.name,
        color: f.color ?? "#6366f1",
      });
    }
  }

  if (push.deletedFolderIds.length > 0) {
    await db
      .delete(folders)
      .where(
        and(eq(folders.userId, userId), inArray(folders.id, push.deletedFolderIds)),
      );
  }

  // ---- prompts (LWW on updatedAt) ----
  for (const p of push.prompts) {
    const existing = await db.query.prompts.findFirst({
      where: eq(prompts.id, p.id),
    });
    if (existing && existing.userId !== userId) continue; // not yours: skip

    // team sharing must be backed by a real membership;
    // public requires a verified email — otherwise fall back to private
    let visibility = p.visibility ?? "private";
    let teamId = p.teamId ?? null;
    if (teamId && !(await isTeamMember(userId, teamId))) {
      teamId = null;
    }
    if (visibility === "public" && !g.user.emailVerified) {
      visibility = "private";
    }

    const clientUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date();
    if (existing) {
      if (existing.updatedAt >= clientUpdatedAt) continue; // server wins
      await db
        .update(prompts)
        .set({
          title: p.title,
          body: p.body,
          tags: p.tags ?? [],
          folderId: p.folderId ?? null,
          visibility,
          teamId,
          pinned: p.pinned ?? existing.pinned,
          updatedAt: clientUpdatedAt,
        })
        .where(eq(prompts.id, p.id));
    } else {
      await db
        .insert(prompts)
        .values({
          id: p.id,
          userId,
          folderId: p.folderId ?? null,
          title: p.title,
          body: p.body,
          tags: p.tags ?? [],
          visibility,
          teamId,
          pinned: p.pinned ?? false,
          sourceId: p.sourceId ?? null,
          updatedAt: clientUpdatedAt,
        })
        .onConflictDoNothing(); // (user, sourceId) already present from another path
    }
  }

  if (push.deletedPromptIds.length > 0) {
    await db
      .update(prompts)
      .set({ deleted: true, updatedAt: new Date() })
      .where(
        and(eq(prompts.userId, userId), inArray(prompts.id, push.deletedPromptIds)),
      );
  }

  // ---- authoritative snapshot back ----
  const [allPrompts, allFolders] = await Promise.all([
    db
      .select()
      .from(prompts)
      .where(and(eq(prompts.userId, userId), eq(prompts.deleted, false))),
    db.select().from(folders).where(eq(folders.userId, userId)),
  ]);

  return jsonOk({
    prompts: allPrompts,
    folders: allFolders,
    syncedAt: new Date().toISOString(),
  });
}
