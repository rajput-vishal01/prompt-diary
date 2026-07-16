import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, user } from "@/db/schema";
import { applySubscriptionEvent, hasActivePlan, verifyWebhook } from "@/lib/billing";

// Billing gate + webhook plumbing. billingEnabled is false in the test env
// (no POLAR_ACCESS_TOKEN), so hasActivePlan must fail OPEN — that's the
// free-for-everyone dev/self-hosted behavior.

const uid = (s: string) => `test-billing-${s}-${crypto.randomUUID()}`;
const alice = uid("alice");

beforeAll(async () => {
  await db.insert(user).values({ id: alice, name: "Alice", email: `${alice}@test.local` });
});

afterAll(async () => {
  await db.delete(subscriptions).where(eq(subscriptions.userId, alice));
  await db.delete(user).where(inArray(user.id, [alice]));
});

describe("hasActivePlan with billing disabled", () => {
  test("everyone passes — free tier for all", async () => {
    expect(await hasActivePlan(alice)).toBe(true);
    expect(await hasActivePlan("nonexistent-user")).toBe(true);
  });
});

describe("applySubscriptionEvent", () => {
  test("mirrors an active subscription via external_id", async () => {
    const handled = await applySubscriptionEvent({
      type: "subscription.active",
      data: {
        id: "sub_123",
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        customer: { id: "cus_1", external_id: alice },
      },
    });
    expect(handled).toBe(true);
    const row = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, alice),
    });
    expect(row?.status).toBe("active");
    expect(row?.subscriptionId).toBe("sub_123");
  });

  test("revocation downgrades the same row", async () => {
    await applySubscriptionEvent({
      type: "subscription.revoked",
      data: { id: "sub_123", customer: { id: "cus_1", external_id: alice } },
    });
    const row = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, alice),
    });
    expect(row?.status).toBe("revoked");
  });

  test("ignores non-subscription events and missing user linkage", async () => {
    expect(
      await applySubscriptionEvent({ type: "order.created", data: { id: "x" } }),
    ).toBe(false);
    expect(
      await applySubscriptionEvent({
        type: "subscription.active",
        data: { id: "sub_9", status: "active" },
      }),
    ).toBe(false);
  });
});

describe("verifyWebhook (standard webhooks HMAC)", () => {
  const secretB64 = Buffer.from("super-secret-key").toString("base64");
  const sign = (id: string, ts: string, payload: string) =>
    createHmac("sha256", Buffer.from(secretB64, "base64"))
      .update(`${id}.${ts}.${payload}`)
      .digest("base64");

  test("accepts a valid signature and rejects a tampered payload", () => {
    process.env.POLAR_WEBHOOK_SECRET = `whsec_${secretB64}`;
    const payload = JSON.stringify({ type: "subscription.active" });
    const headers = {
      id: "msg_1",
      timestamp: "1700000000",
      signature: `v1,${sign("msg_1", "1700000000", payload)}`,
    };
    expect(verifyWebhook(payload, headers)).toBe(true);
    expect(verifyWebhook(payload + "x", headers)).toBe(false);
    delete process.env.POLAR_WEBHOOK_SECRET;
  });

  test("rejects when secret or headers are missing", () => {
    expect(
      verifyWebhook("{}", { id: "a", timestamp: "b", signature: "v1,c" }),
    ).toBe(false);
  });
});
