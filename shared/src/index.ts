import { z } from "zod";

// ---------- enums ----------

export const VISIBILITIES = ["private", "team", "public"] as const;
export const VisibilitySchema = z.enum(VISIBILITIES);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const TeamRoleSchema = z.enum(["owner", "member"]);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

// ---------- core entities ----------

export const FolderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  createdAt: z.string(), // ISO
  updatedAt: z.string(),
});
export type Folder = z.infer<typeof FolderSchema>;

export const PromptSchema = z.object({
  id: z.string(),
  userId: z.string(),
  folderId: z.string().nullable(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  visibility: VisibilitySchema.default("private"),
  teamId: z.string().nullable(),
  useCount: z.number().int().nonnegative().default(0),
  pinned: z.boolean().default(false),
  sourceId: z.string().nullable().default(null), // gallery prompt this was copied from
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Prompt = z.infer<typeof PromptSchema>;

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  ownerId: z.string(),
  createdAt: z.string(),
});
export type Team = z.infer<typeof TeamSchema>;

// ---------- API inputs (what clients send) ----------

export const PromptCreateSchema = PromptSchema.pick({
  title: true,
  body: true,
}).extend({
  id: z.string().uuid().optional(), // client-generated for offline-first sync
  folderId: z.string().nullable().optional(),
  tags: PromptSchema.shape.tags.optional(),
  visibility: VisibilitySchema.optional(),
  teamId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  sourceId: z.string().nullable().optional(),
  updatedAt: z.string().optional(), // for LWW sync
});
export type PromptCreate = z.infer<typeof PromptCreateSchema>;

export const PromptUpdateSchema = PromptCreateSchema.partial().extend({
  useCount: z.number().int().nonnegative().optional(),
});
export type PromptUpdate = z.infer<typeof PromptUpdateSchema>;

export const FolderCreateSchema = FolderSchema.pick({ name: true }).extend({
  id: z.string().uuid().optional(),
  color: FolderSchema.shape.color.optional(),
});
export type FolderCreate = z.infer<typeof FolderCreateSchema>;

export const TeamCreateSchema = TeamSchema.pick({ name: true });
export type TeamCreate = z.infer<typeof TeamCreateSchema>;

export const TeamInviteSchema = z.object({
  email: z.string().email(),
});
export type TeamInvite = z.infer<typeof TeamInviteSchema>;

// ---------- sync ----------

export const SyncPushSchema = z.object({
  prompts: z.array(PromptCreateSchema.extend({ id: z.string().uuid() })),
  folders: z.array(FolderCreateSchema.extend({ id: z.string().uuid() })),
  deletedPromptIds: z.array(z.string().uuid()).default([]),
  deletedFolderIds: z.array(z.string().uuid()).default([]),
});
export type SyncPush = z.infer<typeof SyncPushSchema>;

// ---------- API envelope ----------

export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };

export const ok = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  error: null,
});

export const err = (error: string): ApiResponse<never> => ({
  success: false,
  data: null,
  error,
});
