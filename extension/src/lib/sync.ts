import type { Folder, Prompt } from "shared";
import { api, getAuth } from "./api";
import { getVault, setVault } from "./vault";

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
    return { synced: true };
  } catch (e) {
    return { synced: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}
