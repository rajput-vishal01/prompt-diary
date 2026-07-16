import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { prompts, threads, threadSteps, user } from "@/db/schema";
import { canReadThread } from "@/lib/permissions";
import { loadThreadForViewer } from "@/lib/threads";

// Thread visibility gate + per-step redaction: a public recipe must never
// leak the body of a private step prompt. Runs against local docker postgres.

const uid = (s: string) => `test-thread-${s}-${crypto.randomUUID()}`;

const owner = uid("owner");
const stranger = uid("stranger");
const publicThread = uid("pub");
const privateThread = uid("priv");
const publicStep = uid("step-pub");
const privateStep = uid("step-priv");

beforeAll(async () => {
  await db.insert(user).values([
    { id: owner, name: "Owner", email: `${owner}@test.local` },
    { id: stranger, name: "Stranger", email: `${stranger}@test.local` },
  ]);
  await db.insert(prompts).values([
    { id: publicStep, userId: owner, title: "Public step", body: "public body", visibility: "public" },
    { id: privateStep, userId: owner, title: "Secret step", body: "SECRET body", visibility: "private" },
  ]);
  await db.insert(threads).values([
    { id: publicThread, userId: owner, title: "Public recipe", visibility: "public" },
    { id: privateThread, userId: owner, title: "Private recipe", visibility: "private" },
  ]);
  await db.insert(threadSteps).values([
    { threadId: publicThread, promptId: publicStep, order: 0 },
    { threadId: publicThread, promptId: privateStep, order: 1 },
  ]);
});

afterAll(async () => {
  await db.delete(threads).where(inArray(threads.id, [publicThread, privateThread]));
  await db.delete(prompts).where(inArray(prompts.id, [publicStep, privateStep]));
  await db.delete(user).where(inArray(user.id, [owner, stranger]));
});

describe("canReadThread", () => {
  const pub = { userId: owner, visibility: "public" };
  const priv = { userId: owner, visibility: "private" };

  test("owner reads both", () => {
    expect(canReadThread(owner, pub)).toBe(true);
    expect(canReadThread(owner, priv)).toBe(true);
  });
  test("stranger and anon read public only", () => {
    expect(canReadThread(stranger, pub)).toBe(true);
    expect(canReadThread(null, pub)).toBe(true);
    expect(canReadThread(stranger, priv)).toBe(false);
    expect(canReadThread(null, priv)).toBe(false);
  });
});

describe("loadThreadForViewer redaction", () => {
  test("private thread is null for anon, full for owner", async () => {
    expect(await loadThreadForViewer(privateThread, null)).toBeNull();
    const mine = await loadThreadForViewer(privateThread, owner);
    expect(mine?.title).toBe("Private recipe");
  });

  test("anon sees public steps in full, private steps title-only", async () => {
    const t = await loadThreadForViewer(publicThread, null);
    expect(t).not.toBeNull();
    expect(t!.steps).toHaveLength(2);

    const [open, secret] = t!.steps;
    expect(open!.redacted).toBe(false);
    expect((open!.prompt as { body?: string }).body).toBe("public body");

    expect(secret!.redacted).toBe(true);
    expect(secret!.prompt.title).toBe("Secret step");
    expect(JSON.stringify(secret)).not.toContain("SECRET body");
  });

  test("owner sees every step in full", async () => {
    const t = await loadThreadForViewer(publicThread, owner);
    expect(t!.steps.every((s) => !s.redacted)).toBe(true);
  });
});
