# Memory: Infra hardening — rate limiting and Cloudinary cleanup

**Shipped:** 2026-07-15, commits d7c2508 (chunk 2) and 618377a (chunk 3).

## Upstash rate limiting (d7c2508)

`rateLimit()` in `web/src/lib/api.ts` became async and env-gated: when
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set it uses
`@upstash/ratelimit` with a sliding window (120 requests / 60 s, prefix `pd-rl`);
otherwise it keeps the original in-memory sliding window so dev and local need zero
setup. Redis errors **fail open** — a Redis hiccup must never take the API down.
This landed before share links made anonymous traffic real. The env-gating pattern
established here (config present → feature on, absent → safe fallback) was reused by
billing later.

## Cloudinary destroy + orphan cleanup (618377a)

`web/src/lib/cloudinary.ts` is the missing half of the signed direct-upload flow:

- `publicIdFromUrl(url)` parses the public_id out of a
  `res.cloudinary.com/<cloud>/image/upload/v123/prompt-diary/<userId>/<id>.png` URL.
- `destroyImage(url, userId)` signs a destroy call (SHA-1 of sorted params + secret)
  and POSTs it. **Ownership guard:** only public_ids prefixed
  `prompt-diary/{userId}/` are ever destroyed. Best-effort — failures are swallowed
  because an orphaned image is never worth a 500.

Wired fire-and-forget wherever an image is replaced or removed: prompts PATCH
(imageBefore/imageAfter changed), threads PATCH and DELETE (finalImage), and
`POST /api/v1/uploads/destroy` for the profile avatar replace flow. The helper was
deliberately landed early because account deletion (chunk 11) reuses it via
`destroyAllUserImages`.

**Tests:** web/tests/cloudinary.test.ts.
