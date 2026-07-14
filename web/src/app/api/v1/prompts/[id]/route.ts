import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { PromptUpdateSchema } from "shared";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import {
  forbidden,
  getUser,
  guard,
  jsonErr,
  jsonOk,
  needsVerification,
  notFound,
  rateLimit,
  rateLimitKey,
} from "@/lib/api";
import { canAccessPrompt, isTeamMember } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

async function getPrompt(id: string) {
  return db.query.prompts.findFirst({ where: eq(prompts.id, id) });
}

// anonymous allowed: public prompts are world-readable (gallery detail view)
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req);
  if (!rateLimit(rateLimitKey(req, user?.id))) {
    return jsonErr("Too many requests", 429);
  }

  const { id } = await params;
  const row = await getPrompt(id);
  if (!row || row.deleted) return notFound();
  if (!(await canAccessPrompt(user?.id ?? null, row, "read"))) return forbidden();
  return jsonOk(row);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const row = await getPrompt(id);
  if (!row || row.deleted) return notFound();
  if (!(await canAccessPrompt(g.user.id, row, "write"))) return forbidden();

  const parsed = PromptUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);
  const input = parsed.data;

  const nextVisibility = input.visibility ?? row.visibility;
  const nextTeamId =
    input.teamId !== undefined ? input.teamId : row.teamId;

  if (
    nextTeamId &&
    nextTeamId !== row.teamId &&
    !(await isTeamMember(g.user.id, nextTeamId))
  ) {
    return jsonErr("Not a member of that team", 403);
  }
  if (
    nextVisibility === "public" &&
    row.visibility !== "public" &&
    !g.user.emailVerified
  ) {
    return needsVerification();
  }

  // a useCount-only patch (the Copy button) must NOT bump updatedAt —
  // otherwise copying on one device makes LWW sync discard real edits
  // made on another device
  const contentChanged =
    input.title !== undefined ||
    input.body !== undefined ||
    input.tags !== undefined ||
    input.folderId !== undefined ||
    input.pinned !== undefined ||
    input.visibility !== undefined ||
    input.teamId !== undefined ||
    input.outputBefore !== undefined ||
    input.outputAfter !== undefined;

  const [updated] = await db
    .update(prompts)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.folderId !== undefined && { folderId: input.folderId }),
      ...(input.pinned !== undefined && { pinned: input.pinned }),
      ...(input.outputBefore !== undefined && { outputBefore: input.outputBefore }),
      ...(input.outputAfter !== undefined && { outputAfter: input.outputAfter }),
      ...(input.useCount !== undefined && { useCount: input.useCount }),
      ...(contentChanged && {
        visibility: nextVisibility,
        teamId: nextTeamId,
        updatedAt: new Date(),
      }),
    })
    .where(eq(prompts.id, id))
    .returning();

  return jsonOk(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const row = await getPrompt(id);
  if (!row || row.deleted) return notFound();
  if (!(await canAccessPrompt(g.user.id, row, "write"))) return forbidden();

  // soft delete so sync can propagate the deletion to other devices
  await db
    .update(prompts)
    .set({ deleted: true, updatedAt: new Date() })
    .where(eq(prompts.id, id));

  return jsonOk({ deleted: true });
}
