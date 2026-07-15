import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { guard, jsonErr, jsonOk, notFound } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(), // sidebar drag order
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  const [updated] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, g.user.id)))
    .returning();
  if (!updated) return notFound();
  return jsonOk(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  // threads survive project deletion (projectId → null via FK)
  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, g.user.id)))
    .returning();
  if (!deleted) return notFound();
  return jsonOk({ deleted: true });
}
