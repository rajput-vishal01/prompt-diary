import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, teamMembers, teams, user } from "@/db/schema";
import { canAccessPrompt, type PromptRow } from "@/lib/permissions";

// Permission matrix gate — every cell of
// (owner | team-member | stranger | anon) x (private | team | public) x (read | write)
// Runs against the local docker postgres (web/.env.local).

const uid = (s: string) => `test-perm-${s}-${crypto.randomUUID()}`;

const alice = uid("alice"); // prompt owner + team owner
const bob = uid("bob"); // team member
const carol = uid("carol"); // stranger
const teamId = uid("team");

let privatePrompt: PromptRow;
let teamPrompt: PromptRow;
let publicPrompt: PromptRow;

beforeAll(async () => {
  await db.insert(user).values([
    { id: alice, name: "Alice", email: `${alice}@test.local` },
    { id: bob, name: "Bob", email: `${bob}@test.local` },
    { id: carol, name: "Carol", email: `${carol}@test.local` },
  ]);
  await db.insert(teams).values({ id: teamId, name: "Test Team", ownerId: alice });
  await db.insert(teamMembers).values([
    { teamId, userId: alice, role: "owner" },
    { teamId, userId: bob, role: "member" },
  ]);

  const mk = (visibility: "private" | "team" | "public") =>
    ({
      id: uid(`prompt-${visibility}`),
      userId: alice,
      title: `${visibility} prompt`,
      body: "body",
      visibility,
      teamId: visibility === "team" ? teamId : null,
    }) as const;

  const rows = await db
    .insert(prompts)
    .values([mk("private"), mk("team"), mk("public")])
    .returning();

  privatePrompt = rows.find((r) => r.visibility === "private")!;
  teamPrompt = rows.find((r) => r.visibility === "team")!;
  publicPrompt = rows.find((r) => r.visibility === "public")!;
});

afterAll(async () => {
  // cascades clean up team_members and prompts via FKs
  await db.delete(teams).where(eq(teams.id, teamId));
  for (const id of [alice, bob, carol]) {
    await db.delete(user).where(eq(user.id, id));
  }
});

describe("read access", () => {
  test("private: owner only", async () => {
    expect(await canAccessPrompt(alice, privatePrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, privatePrompt, "read")).toBe(false);
    expect(await canAccessPrompt(carol, privatePrompt, "read")).toBe(false);
    expect(await canAccessPrompt(null, privatePrompt, "read")).toBe(false);
  });

  test("team: owner + members", async () => {
    expect(await canAccessPrompt(alice, teamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, teamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(carol, teamPrompt, "read")).toBe(false);
    expect(await canAccessPrompt(null, teamPrompt, "read")).toBe(false);
  });

  test("public: everyone", async () => {
    expect(await canAccessPrompt(alice, publicPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, publicPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(carol, publicPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(null, publicPrompt, "read")).toBe(true);
  });
});

describe("write access — owner only, regardless of visibility", () => {
  test("private", async () => {
    expect(await canAccessPrompt(alice, privatePrompt, "write")).toBe(true);
    expect(await canAccessPrompt(bob, privatePrompt, "write")).toBe(false);
    expect(await canAccessPrompt(carol, privatePrompt, "write")).toBe(false);
    expect(await canAccessPrompt(null, privatePrompt, "write")).toBe(false);
  });

  test("team — members can read but NOT write", async () => {
    expect(await canAccessPrompt(alice, teamPrompt, "write")).toBe(true);
    expect(await canAccessPrompt(bob, teamPrompt, "write")).toBe(false);
    expect(await canAccessPrompt(carol, teamPrompt, "write")).toBe(false);
    expect(await canAccessPrompt(null, teamPrompt, "write")).toBe(false);
  });

  test("public — world can read but NOT write", async () => {
    expect(await canAccessPrompt(alice, publicPrompt, "write")).toBe(true);
    expect(await canAccessPrompt(bob, publicPrompt, "write")).toBe(false);
    expect(await canAccessPrompt(carol, publicPrompt, "write")).toBe(false);
    expect(await canAccessPrompt(null, publicPrompt, "write")).toBe(false);
  });
});
