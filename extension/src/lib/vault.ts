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
  const vault: Vault = { ...emptyVault(), ...(res[VAULT_KEY] ?? {}) };
  // legacy: visibility "team" is now private + teamId (sharing is independent)
  vault.prompts = vault.prompts.map((p) =>
    (p.visibility as string) === "team" ? { ...p, visibility: "private" } : p,
  );
  return vault;
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

export interface AddResult {
  prompt: Prompt;
  duplicate: boolean;
}

export async function addPrompt(input: NewPrompt): Promise<AddResult> {
  const vault = await getVault();
  // dedupe on exact body — the bubble/menu can be clicked twice on one selection
  const existing = vault.prompts.find((p) => p.body === input.body.trim());
  if (existing) return { prompt: existing, duplicate: true };
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
    sourceId: null,
    outputBefore: null,
    outputAfter: null,
    imageBefore: null,
    imageAfter: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await setVault({ ...vault, prompts: [prompt, ...vault.prompts] });
  return { prompt, duplicate: false };
}

// recently-used ids, most recent first — popup shows these on top
export async function pushRecent(id: string): Promise<void> {
  const res = await chrome.storage.local.get("recentIds");
  const ids = ((res["recentIds"] as string[]) ?? []).filter((x) => x !== id);
  await chrome.storage.local.set({ recentIds: [id, ...ids].slice(0, 5) });
}

export async function getRecents(): Promise<string[]> {
  const res = await chrome.storage.local.get("recentIds");
  return (res["recentIds"] as string[]) ?? [];
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
