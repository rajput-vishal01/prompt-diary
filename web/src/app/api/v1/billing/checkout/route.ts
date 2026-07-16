import { NextRequest } from "next/server";
import { billingEnabled, createCheckout, createPortal, hasActivePlan } from "@/lib/billing";
import { guard, jsonErr, jsonOk } from "@/lib/api";

// POST — returns the URL to send the user to: Polar checkout for free users,
// the customer portal if they already subscribe.
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;
  if (!billingEnabled) return jsonErr("Billing is not configured", 404);

  try {
    const url = (await hasActivePlan(g.user.id))
      ? await createPortal(g.user.id)
      : await createCheckout(
          g.user.id,
          g.user.email,
          `${new URL(req.url).origin}/dashboard/profile`,
        );
    return jsonOk({ url });
  } catch (e) {
    console.error("[billing] checkout/portal failed:", e);
    return jsonErr("Billing provider error — try again shortly", 502);
  }
}
