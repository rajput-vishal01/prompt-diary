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
 * read:  owner | public | team member
 * write: owner only
 */
export async function canAccessPrompt(
  userId: string | null,
  prompt: PromptRow,
  mode: "read" | "write",
): Promise<boolean> {
  const isOwner = userId !== null && prompt.userId === userId;
  if (mode === "write") return isOwner;

  if (isOwner) return true;
  if (prompt.visibility === "public") return true;
  if (prompt.visibility === "team" && prompt.teamId && userId) {
    return isTeamMember(userId, prompt.teamId);
  }
  return false;
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
