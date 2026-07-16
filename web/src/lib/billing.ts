import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";

// Polar billing, entirely env-gated: without POLAR_ACCESS_TOKEN the app is
// free-tier-for-everyone and none of these endpoints do anything. Same
// pattern as the Upstash rate limiter — dev/local needs zero setup.
//
// Env:
//   POLAR_ACCESS_TOKEN    — org access token (sandbox or prod)
//   POLAR_PRODUCT_ID      — the Pro product to check out
//   POLAR_WEBHOOK_SECRET  — webhook endpoint secret
//   POLAR_SERVER          — "sandbox" (default) | "production"

export const billingEnabled = !!process.env.POLAR_ACCESS_TOKEN;

const POLAR_API =
  process.env.POLAR_SERVER === "production"
    ? "https://api.polar.sh/v1"
    : "https://sandbox-api.polar.sh/v1";

async function polar<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${POLAR_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Polar ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Paid-feature gate. Billing off → everything is free, gate always passes. */
export async function hasActivePlan(userId: string): Promise<boolean> {
  if (!billingEnabled) return true;
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!row) return false;
  if (row.status !== "active" && row.status !== "trialing") return false;
  return !row.currentPeriodEnd || row.currentPeriodEnd > new Date();
}

/** Hosted checkout URL for the Pro product. */
export async function createCheckout(userId: string, email: string, successUrl: string) {
  const checkout = await polar<{ url: string }>("/checkouts", {
    products: [process.env.POLAR_PRODUCT_ID],
    external_customer_id: userId, // ties the webhook back to our user
    customer_email: email,
    success_url: successUrl,
  });
  return checkout.url;
}

/** Customer portal URL (manage / cancel the subscription). */
export async function createPortal(userId: string) {
  const session = await polar<{ customer_portal_url: string }>("/customer-sessions", {
    external_customer_id: userId,
  });
  return session.customer_portal_url;
}

// ---------- webhook ----------

/**
 * Standard Webhooks HMAC verification (what Polar uses) — no SDK needed.
 * Signature is base64(hmac-sha256(`${id}.${timestamp}.${payload}`)).
 */
export function verifyWebhook(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
): boolean {
  const secretRaw = process.env.POLAR_WEBHOOK_SECRET;
  if (!secretRaw || !headers.id || !headers.timestamp || !headers.signature) return false;

  // secrets are shown as "whsec_<base64>"
  const secret = Buffer.from(secretRaw.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secret)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest("base64");

  // header can hold several space-separated "v1,<sig>" entries
  return headers.signature.split(" ").some((part) => {
    const sig = part.split(",")[1] ?? part;
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

interface SubscriptionEvent {
  type: string;
  data: {
    id: string;
    status?: string;
    current_period_end?: string | null;
    customer_id?: string;
    customer?: { id?: string; external_id?: string | null };
    metadata?: Record<string, unknown>;
  };
}

/** Mirror a subscription.* event into our table. Returns false if unhandled. */
export async function applySubscriptionEvent(event: SubscriptionEvent): Promise<boolean> {
  if (!event.type.startsWith("subscription.")) return false;

  const userId =
    event.data.customer?.external_id ??
    (typeof event.data.metadata?.userId === "string" ? event.data.metadata.userId : null);
  if (!userId) return false;

  const status =
    event.type === "subscription.revoked" ? "revoked" : (event.data.status ?? "unknown");

  await db
    .insert(subscriptions)
    .values({
      userId,
      provider: "polar",
      customerId: event.data.customer?.id ?? event.data.customer_id ?? null,
      subscriptionId: event.data.id,
      status,
      currentPeriodEnd: event.data.current_period_end
        ? new Date(event.data.current_period_end)
        : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        customerId: event.data.customer?.id ?? event.data.customer_id ?? null,
        subscriptionId: event.data.id,
        status,
        currentPeriodEnd: event.data.current_period_end
          ? new Date(event.data.current_period_end)
          : null,
        updatedAt: new Date(),
      },
    });

  return true;
}
