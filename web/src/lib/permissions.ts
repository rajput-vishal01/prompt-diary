import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, teamMembers } from "@/db/schema";

// SECURITY SPINE — every route that touches a prompt goes through here.
// Never inline visibility checks in route handlers.

export type PromptRow = typeof prompts.$inferSelect;

export async function isTeamMember(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const row = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  return !!row;
}

/**
 * read:  owner | public | member of the prompt's team (teamId is independent
 *        of visibility — a public prompt can also sit in a team library)
 * write: owner only
 */
export async function canAccessPrompt(
  userId: string | null,
  prompt: PromptRow,
  mode: "read" | "write",
): Promise<boolean> {
  // a soft-deleted prompt is readable by nobody. Every other caller filters
  // deleted before reaching here, but a public recipe's steps route through
  // loadThreadForViewer, which relies on this gate to redact deleted steps
  // instead of leaking their body on /r/[id].
  if (prompt.deleted) return false;
  const isOwner = userId !== null && prompt.userId === userId;
  if (mode === "write") return isOwner;

  if (isOwner) return true;
  if (prompt.visibility === "public") return true;
  if (prompt.teamId && userId) {
    return isTeamMember(userId, prompt.teamId);
  }
  return false;
}

/**
 * Threads only have private|public — read is owner or public, write is owner.
 * Pure (no team tier), so it stays synchronous and trivially testable.
 */
export function canReadThread(
  userId: string | null,
  thread: { userId: string; visibility: string },
): boolean {
  if (userId !== null && thread.userId === userId) return true;
  return thread.visibility === "public";
}

export async function isTeamOwner(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const row = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, userId),
      eq(teamMembers.role, "owner"),
    ),
  });
  return !!row;
}
