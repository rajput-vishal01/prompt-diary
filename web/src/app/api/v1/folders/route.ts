import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { FolderCreateSchema } from "shared";
import { db } from "@/db";
import { folders } from "@/db/schema";
import { guard, jsonErr, jsonOk } from "@/lib/api";

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.userId, g.user.id))
    .orderBy(asc(folders.sortOrder), asc(folders.name));
  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = FolderCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  const [row] = await db
    .insert(folders)
    .values({
      id: parsed.data.id ?? crypto.randomUUID(),
      userId: g.user.id,
      name: parsed.data.name,
      color: parsed.data.color ?? "#6366f1",
    })
    .returning();
  return jsonOk(row, 201);
}
