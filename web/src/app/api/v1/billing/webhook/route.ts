import { NextRequest, NextResponse } from "next/server";
import { applySubscriptionEvent, billingEnabled, verifyWebhook } from "@/lib/billing";

// POST — Polar webhook. Standard Webhooks signature, raw-body verification.
// Unhandled event types are acked with 200 so Polar doesn't retry them.
export async function POST(req: NextRequest) {
  if (!billingEnabled) return NextResponse.json({ error: "not configured" }, { status: 404 });

  const payload = await req.text();
  const ok = verifyWebhook(payload, {
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
  });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 403 });

  try {
    const event = JSON.parse(payload);
    await applySubscriptionEvent(event);
  } catch (e) {
    console.error("[billing] webhook handling failed:", e);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
