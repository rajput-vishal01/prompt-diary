import { createHash } from "node:crypto";

// Server-side Cloudinary asset destruction — the missing half of the signed
// direct-upload flow. Called fire-and-forget when an image is replaced or
// removed so orphans don't pile up, and by account deletion.

// upload URLs look like:
// https://res.cloudinary.com/<cloud>/image/upload/v123456/prompt-diary/<userId>/<id>.png
// public_id is everything after the version segment, without the extension
export function publicIdFromUrl(url: string): string | null {
  const m = url.match(/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return m?.[1] ?? null;
}

/**
 * Best-effort destruction of EVERY asset a user owns — account deletion.
 * Collects known URLs from their rows (prompt panes, thread screenshots,
 * avatar) and destroys each; the user-folder guard in destroyImage still
 * applies per URL.
 */
export async function destroyAllUserImages(
  userId: string,
  urls: Array<string | null | undefined>,
): Promise<void> {
  await Promise.allSettled(urls.filter(Boolean).map((u) => destroyImage(u, userId)));
}

/**
 * Destroy a Cloudinary asset by its delivery URL. `userId` is the ownership
 * guard: only assets inside that user's folder are ever destroyed.
 * Best-effort — failures are swallowed (an orphaned image is not worth a 500).
 */
export async function destroyImage(url: string | null | undefined, userId: string): Promise<void> {
  if (!url) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;

  const publicId = publicIdFromUrl(url);
  if (!publicId || !publicId.startsWith(`prompt-diary/${userId}/`)) return;

  const timestamp = Math.floor(Date.now() / 1000);
  // cloudinary signature: sha1 of sorted params + api secret
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  try {
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: "POST",
      body,
    });
  } catch {
    // best-effort cleanup — never surface to the caller
  }
}
