import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { guard, jsonErr, jsonOk } from "@/lib/api";

// Signs direct-to-Cloudinary uploads — image bytes never touch this server.
// Needs CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return jsonErr("Uploads not configured", 501);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `prompt-diary/${g.user.id}`;
  // pin the upload to image formats — signed params are enforced by
  // Cloudinary, so a signed request can't smuggle raw/video/arbitrary files
  // into the account (cost inflation / file hosting)
  const allowedFormats = "jpg,jpeg,png,webp,gif,avif";
  // cloudinary signature: sha1 of alphabetically-sorted params + api secret
  const toSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  return jsonOk({ cloudName, apiKey, timestamp, folder, allowedFormats, signature });
}
