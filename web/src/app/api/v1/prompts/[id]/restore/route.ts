import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { forbidden, guard, jsonOk, notFound } from "@/lib/api";

// POST — undo a soft delete (the Undo button in the delete toast)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const { id } = await params;
  const row = await db.query.prompts.findFirst({ where: eq(prompts.id, id) });
  if (!row) return notFound();
  if (row.userId !== g.user.id) return forbidden();

  const [restored] = await db
    .update(prompts)
    .set({ deleted: false, updatedAt: new Date() })
    .where(eq(prompts.id, id))
    .returning();
  return jsonOk(restored);
}
