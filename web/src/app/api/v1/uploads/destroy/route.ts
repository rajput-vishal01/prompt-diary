import { NextRequest } from "next/server";
import { z } from "zod";
import { guard, jsonErr, jsonOk } from "@/lib/api";
import { destroyImage } from "@/lib/cloudinary";

const DestroySchema = z.object({ url: z.string().url().max(500) });

// Client-initiated cleanup for flows the server can't intercept (the Better
// Auth avatar update). destroyImage enforces the user-folder ownership guard,
// so a user can only ever destroy their own assets.
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const parsed = DestroySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  await destroyImage(parsed.data.url, g.user.id);
  return jsonOk({ ok: true });
}
