import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, teamMembers, teams, user } from "@/db/schema";
import { canAccessPrompt, type PromptRow } from "@/lib/permissions";

// Permission matrix gate. Visibility (private|public) and team sharing
// (teamId) are independent axes — the matrix covers all four combos across
// (owner | team-member | stranger | anon) x (read | write).
// Runs against the local docker postgres.

const uid = (s: string) => `test-perm-${s}-${crypto.randomUUID()}`;

const alice = uid("alice"); // prompt owner + team owner
const bob = uid("bob"); // team member
const carol = uid("carol"); // stranger
const teamId = uid("team");

let privatePrompt: PromptRow; // private, no team
let teamPrompt: PromptRow; // private + team-shared
let publicPrompt: PromptRow; // public, no team
let publicTeamPrompt: PromptRow; // public + team-shared (the new combo)

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

  const mk = (
    key: string,
    visibility: "private" | "public",
    team: string | null,
  ) =>
    ({
      id: uid(`prompt-${key}`),
      userId: alice,
      title: `${key} prompt`,
      body: "body",
      visibility,
      teamId: team,
    }) as const;

  const rows = await db
    .insert(prompts)
    .values([
      mk("private", "private", null),
      mk("team", "private", teamId),
      mk("public", "public", null),
      mk("publicteam", "public", teamId),
    ])
    .returning();

  privatePrompt = rows.find((r) => r.title.startsWith("private"))!;
  teamPrompt = rows.find((r) => r.title.startsWith("team"))!;
  publicPrompt = rows.find((r) => r.title.startsWith("public "))!;
  publicTeamPrompt = rows.find((r) => r.title.startsWith("publicteam"))!;
});

afterAll(async () => {
  await db.delete(teams).where(eq(teams.id, teamId));
  for (const id of [alice, bob, carol]) {
    await db.delete(user).where(eq(user.id, id));
  }
});

describe("read access", () => {
  test("private, no team: owner only", async () => {
    expect(await canAccessPrompt(alice, privatePrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, privatePrompt, "read")).toBe(false);
    expect(await canAccessPrompt(carol, privatePrompt, "read")).toBe(false);
    expect(await canAccessPrompt(null, privatePrompt, "read")).toBe(false);
  });

  test("private + team: owner and members", async () => {
    expect(await canAccessPrompt(alice, teamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, teamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(carol, teamPrompt, "read")).toBe(false);
    expect(await canAccessPrompt(null, teamPrompt, "read")).toBe(false);
  });

  test("public, no team: everyone", async () => {
    expect(await canAccessPrompt(alice, publicPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, publicPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(carol, publicPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(null, publicPrompt, "read")).toBe(true);
  });

  test("public + team: everyone (both audiences at once)", async () => {
    expect(await canAccessPrompt(alice, publicTeamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(bob, publicTeamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(carol, publicTeamPrompt, "read")).toBe(true);
    expect(await canAccessPrompt(null, publicTeamPrompt, "read")).toBe(true);
  });
});

describe("write access — owner only, regardless of visibility or team", () => {
  test("all four combos", async () => {
    for (const p of [privatePrompt, teamPrompt, publicPrompt, publicTeamPrompt]) {
      expect(await canAccessPrompt(alice, p, "write")).toBe(true);
      expect(await canAccessPrompt(bob, p, "write")).toBe(false);
      expect(await canAccessPrompt(carol, p, "write")).toBe(false);
      expect(await canAccessPrompt(null, p, "write")).toBe(false);
    }
  });
});
