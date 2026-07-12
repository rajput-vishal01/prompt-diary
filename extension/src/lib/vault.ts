import type { Folder, Prompt, Visibility } from "shared";

// Local-first vault stored in chrome.storage.local.
// Works fully offline; sync engine reconciles with the server when logged in.

export interface Vault {
  prompts: Prompt[];
  folders: Folder[];
  deletedPromptIds: string[];
  deletedFolderIds: string[];
  lastSyncAt: string | null;
}

const VAULT_KEY = "vault";
export const LOCAL_USER = "local";

const emptyVault = (): Vault => ({
  prompts: [],
  folders: [],
  deletedPromptIds: [],
  deletedFolderIds: [],
  lastSyncAt: null,
});

export async function getVault(): Promise<Vault> {
  const res = await chrome.storage.local.get(VAULT_KEY);
  return { ...emptyVault(), ...(res[VAULT_KEY] ?? {}) };
}

export async function setVault(vault: Vault): Promise<void> {
  await chrome.storage.local.set({ [VAULT_KEY]: vault });
}

const now = () => new Date().toISOString();

export interface NewPrompt {
  title: string;
  body: string;
  folderId?: string | null;
  tags?: string[];
  visibility?: Visibility;
  teamId?: string | null;
}

export async function addPrompt(input: NewPrompt): Promise<Prompt> {
  const vault = await getVault();
  const prompt: Prompt = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER,
    folderId: input.folderId ?? null,
    title: input.title,
    body: input.body,
    tags: input.tags ?? [],
    visibility: input.visibility ?? "private",
    teamId: input.teamId ?? null,
    useCount: 0,
    pinned: false,
    createdAt: now(),
    updatedAt: now(),
  };
  await setVault({ ...vault, prompts: [prompt, ...vault.prompts] });
  return prompt;
}

export async function updatePrompt(
  id: string,
  patch: Partial<Omit<Prompt, "id" | "userId" | "createdAt">>,
): Promise<void> {
  const vault = await getVault();
  await setVault({
    ...vault,
    prompts: vault.prompts.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: now() } : p,
    ),
  });
}

export async function deletePrompt(id: string): Promise<void> {
  const vault = await getVault();
  await setVault({
    ...vault,
    prompts: vault.prompts.filter((p) => p.id !== id),
    deletedPromptIds: [...vault.deletedPromptIds, id],
  });
}

export async function addFolder(name: string, color = "#6366f1"): Promise<Folder> {
  const vault = await getVault();
  const folder: Folder = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER,
    name,
    color,
    createdAt: now(),
    updatedAt: now(),
  };
  await setVault({ ...vault, folders: [...vault.folders, folder] });
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const vault = await getVault();
  await setVault({
    ...vault,
    folders: vault.folders.map((f) =>
      f.id === id ? { ...f, name, updatedAt: now() } : f,
    ),
  });
}

export async function deleteFolder(id: string): Promise<void> {
  const vault = await getVault();
  await setVault({
    ...vault,
    folders: vault.folders.filter((f) => f.id !== id),
    deletedFolderIds: [...vault.deletedFolderIds, id],
    // prompts in the folder become uncategorized, not deleted
    prompts: vault.prompts.map((p) =>
      p.folderId === id ? { ...p, folderId: null, updatedAt: now() } : p,
    ),
  });
}

export async function bumpUseCount(id: string): Promise<void> {
  const vault = await getVault();
  await setVault({
    ...vault,
    prompts: vault.prompts.map((p) =>
      p.id === id ? { ...p, useCount: p.useCount + 1 } : p,
    ),
  });
}
