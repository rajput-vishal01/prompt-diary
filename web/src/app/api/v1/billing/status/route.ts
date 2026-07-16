import { NextRequest } from "next/server";
import { billingEnabled, hasActivePlan } from "@/lib/billing";
import { guard, jsonOk } from "@/lib/api";

// GET — what the profile Plan section renders from.
// enabled:false = no billing configured, everything is free (self-hosted/dev).
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("response" in g) return g.response;

  if (!billingEnabled) return jsonOk({ enabled: false, active: true, plan: "free" });

  const active = await hasActivePlan(g.user.id);
  return jsonOk({ enabled: true, active, plan: active ? "pro" : "free" });
}
