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
  sourceConvo?: string | null;
}

export interface AddResult {
  prompt: Prompt;
  duplicate: boolean;
}

// shared/src schema limits, enforced at THIS boundary: the vault has no
// validation of its own, and one oversized save (a 60k-char page selection)
// would make every future /sync push fail Zod validation — permanently.
const TITLE_MAX = 200;
const BODY_MAX = 50_000;
const TAG_MAX = 50;
const TAGS_MAX = 20;
const CONVO_MAX = 300;

const clampTags = (tags: string[]) =>
  tags.slice(0, TAGS_MAX).map((t) => t.slice(0, TAG_MAX));

export async function addPrompt(input: NewPrompt): Promise<AddResult> {
  const vault = await getVault();
  const body = input.body.trim().slice(0, BODY_MAX);
  // dedupe on exact stored body — the bubble/menu can be clicked twice on one
  // selection (bodies are stored trimmed, so compare the trimmed form)
  const existing = vault.prompts.find((p) => p.body === body);
  if (existing) return { prompt: existing, duplicate: true };
  const prompt: Prompt = {
    id: crypto.randomUUID(),
    userId: LOCAL_USER,
    folderId: input.folderId ?? null,
    title: input.title.trim().slice(0, TITLE_MAX) || body.slice(0, 60) || "Untitled",
    body,
    tags: clampTags(input.tags ?? []),
    visibility: input.visibility ?? "private",
    teamId: input.teamId ?? null,
    useCount: 0,
    pinned: false,
    sourceId: null,
    outputBefore: null,
    outputAfter: null,
    imageBefore: null,
    imageAfter: null,
    sourceConvo: input.sourceConvo?.slice(0, CONVO_MAX) ?? null,
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
  const clamped = { ...patch };
  if (clamped.title !== undefined) clamped.title = clamped.title.slice(0, TITLE_MAX);
  if (clamped.body !== undefined) clamped.body = clamped.body.slice(0, BODY_MAX);
  if (clamped.tags !== undefined) clamped.tags = clampTags(clamped.tags);
  await setVault({
    ...vault,
    prompts: vault.prompts.map((p) =>
      p.id === id ? { ...p, ...clamped, updatedAt: now() } : p,
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
    sortOrder: 0, // sidebar drag order lives on the web; local folders append
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
