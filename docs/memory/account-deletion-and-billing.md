# Memory: Account deletion + env-gated Polar billing

**Shipped:** 2026-07-16, commits d4f1ef4 (chunk 11) and 2a87fc9 (chunk 13).

## Self-serve account deletion (d4f1ef4)

- Better Auth `user.deleteUser.enabled: true` in `web/src/lib/auth.ts`. The
  `beforeDelete` hook sweeps Cloudinary BEFORE the rows referencing the assets
  cascade away: it collects every known URL (prompt imageBefore/imageAfter, thread
  finalImage, user avatar) and calls `destroyAllUserImages(userId, urls)` — a
  Promise.allSettled wrapper over `destroyImage`, so the per-URL user-folder
  ownership guard still applies.
- DB rows need no manual cleanup: every app table references user.id with
  `onDelete: cascade`.
- Profile UI: a DangerZone section (danger-colored caption label) that expands
  inline — permanence explanation, type-your-email confirm (button disabled until it
  matches, case-insensitive), optional password field ("leave empty if you signed in
  with Google" — credential users verify by password, Google users rely on Better
  Auth's fresh-session check). On success the session is dead → hard redirect to /.
- Verified end-to-end: throwaway account signed up, created a prompt, deleted via
  `/api/auth/delete-user` — user row gone, prompts cascaded.

## Polar billing, entirely env-gated (2a87fc9)

The Upstash pattern again: no `POLAR_ACCESS_TOKEN` → billing is invisible and
everything is free (dev/self-hosted default). Env vars documented in .env.example:
POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID, POLAR_WEBHOOK_SECRET, POLAR_SERVER
(sandbox|production).

- Migration 0012: `subscriptions` — ONE row per user (userId PK), mirrored from
  webhooks: provider, customerId, subscriptionId, status, plan, currentPeriodEnd.
  Absence of a row = free tier.
- `web/src/lib/billing.ts`: raw REST to api.polar.sh (no SDK dependency).
  `hasActivePlan()` FAILS OPEN when billing is disabled — that is the
  free-for-everyone behavior, tested explicitly. Checkout passes
  `external_customer_id = our userId`, which is what ties webhook events back to a
  user. `createPortal` returns the customer-portal URL for existing subscribers.
- Webhook `/api/v1/billing/webhook`: Standard Webhooks HMAC verification implemented
  with node:crypto (base64 secret after stripping `whsec_`, HMAC-SHA256 over
  `id.timestamp.payload`, timingSafeEqual against each `v1,<sig>` entry). Handled
  subscription.* events upsert the row; everything else is acked 200 so Polar stops
  retrying.
- **The single Pro gate:** `GET /api/v1/teams/[id]/usage` returns 402 without an
  active plan. UI catches it quietly: teams detail shows a "Token spend is part of
  the Pro plan" panel with an Upgrade button; profile shows a Plan section
  (renders nothing when billing is disabled). `/api/v1/billing/checkout` returns the
  right URL for either state (checkout vs portal).

**Tests:** web/tests/billing.test.ts — fail-open gate, webhook event mirroring +
revocation, HMAC accept/reject.
