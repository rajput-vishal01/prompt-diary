import type { Folder, Prompt } from "shared";
import { api, getAuth } from "./api";
import { getVault, setVault } from "./vault";

// steps recorded while the prompt only existed locally — appended after sync
async function flushPendingSteps(): Promise<void> {
  const res = await chrome.storage.local.get("pendingSteps");
  const queue =
    (res["pendingSteps"] as Array<{ threadId: string; promptId: string }>) ?? [];
  if (queue.length === 0) return;

  const byThread = new Map<string, string[]>();
  for (const s of queue) {
    byThread.set(s.threadId, [...(byThread.get(s.threadId) ?? []), s.promptId]);
  }
  try {
    for (const [threadId, promptIds] of byThread) {
      const thread = await api<{ steps: Array<{ prompt: { id: string } }> }>(
        `/api/v1/threads/${threadId}`,
      );
      const existing = thread.steps.map((s) => s.prompt.id);
      const merged = [...existing, ...promptIds.filter((p) => !existing.includes(p))];
      await api(`/api/v1/threads/${threadId}`, {
        method: "PATCH",
        body: { promptIds: merged },
      });
    }
    await chrome.storage.local.remove("pendingSteps");
  } catch {
    // keep the queue; next sync retries
  }
}

interface SyncResult {
  prompts: Prompt[];
  folders: Folder[];
  syncedAt: string;
}

/**
 * Push local state, receive the authoritative snapshot back (LWW on the
 * server), and replace the local vault with it.
 */
export async function syncNow(): Promise<{ synced: boolean; error?: string }> {
  const auth = await getAuth();
  if (!auth) return { synced: false, error: "Not signed in" };

  const vault = await getVault();
  try {
    const result = await api<SyncResult>("/api/v1/sync", {
      method: "POST",
      body: {
        prompts: vault.prompts.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          tags: p.tags,
          folderId: p.folderId,
          visibility: p.visibility,
          teamId: p.teamId,
          pinned: p.pinned,
          sourceId: p.sourceId,
          outputBefore: p.outputBefore,
          outputAfter: p.outputAfter,
          imageBefore: p.imageBefore,
          imageAfter: p.imageAfter,
          sourceConvo: p.sourceConvo,
          updatedAt: p.updatedAt,
        })),
        folders: vault.folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
        })),
        deletedPromptIds: vault.deletedPromptIds,
        deletedFolderIds: vault.deletedFolderIds,
      },
    });

    await setVault({
      prompts: result.prompts,
      folders: result.folders,
      deletedPromptIds: [],
      deletedFolderIds: [],
      lastSyncAt: result.syncedAt,
    });
    await flushPendingSteps(); // prompts now exist server-side — attach queued steps
    return { synced: true };
  } catch (e) {
    return { synced: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}
