import { z } from "zod";

// ---------- enums ----------

// visibility says who can see it in the world; team sharing is independent —
// a prompt with teamId set is ALSO visible to that team's members, whatever
// its visibility. (legacy value "team" is normalized to private + teamId)
export const VISIBILITIES = ["private", "public"] as const;
export const VisibilitySchema = z.enum(VISIBILITIES);
export type Visibility = z.infer<typeof VisibilitySchema>;

// only our own CDN — public prompts must not embed third-party images
// (a hotlinked tracker would fire in every gallery visitor's browser)
export const ImageUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine((u) => u.startsWith("https://res.cloudinary.com/"), {
    message: "Images must be uploaded through the app",
  });

// ---------- computed style facets ----------

// Facets are HEURISTICS computed from the prompt text at render time — never
// stored, never an enum column. A prompt can match several at once, and the
// rules can evolve without a migration.
export const FACETS = ["few-shot", "chain-of-thought", "role-play", "template"] as const;
export type Facet = (typeof FACETS)[number];

export function promptFacets(body: string): Facet[] {
  const out: Facet[] = [];
  // few-shot: two or more example blocks (Example 1…, Input:/Output: pairs, Q:/A: pairs)
  const exampleBlocks = (body.match(/^\s*(example\s*\d|input\s*:|q\s*[:.)])/gim) ?? []).length;
  if (exampleBlocks >= 2) out.push("few-shot");
  if (/step[ -]by[ -]step|chain[ -]of[ -]thought|show your (reasoning|work)|let'?s think|reason (through|about) (this|it)/i.test(body))
    out.push("chain-of-thought");
  if (/\b(you are (a|an|the|my)|you'?re (a|an|the)|act as|pretend to be|play the role of|roleplay)\b/i.test(body))
    out.push("role-play");
  // template: fill-in slots — {{var}} or [PLACEHOLDER] (angle brackets excluded: too many HTML false positives)
  if (/\{\{[^{}]+\}\}|\[[A-Z][A-Z0-9_ ]{2,}\]/.test(body)) out.push("template");
  return out;
}

// ---------- core entities ----------

export const FolderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  sortOrder: z.number().int().default(0), // sidebar drag order
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
  visibility: VisibilitySchema.catch("private").default("private"),
  teamId: z.string().nullable(),
  useCount: z.number().int().nonnegative().default(0),
  pinned: z.boolean().default(false),
  sourceId: z.string().nullable().default(null), // gallery prompt this was copied from
  outputBefore: z.string().max(50_000).nullable().default(null),
  outputAfter: z.string().max(50_000).nullable().default(null),
  imageBefore: ImageUrlSchema.nullable().default(null),
  imageAfter: ImageUrlSchema.nullable().default(null),
  sourceConvo: z.string().max(300).nullable().default(null), // chat-conversation fingerprint
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
  // .catch: old clients may still send "team" — treat as private (teamId carries the sharing)
  visibility: VisibilitySchema.optional().catch("private"),
  teamId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  sourceId: z.string().nullable().optional(),
  outputBefore: z.string().max(50_000).nullable().optional(),
  outputAfter: z.string().max(50_000).nullable().optional(),
  imageBefore: ImageUrlSchema.nullable().optional(),
  imageAfter: ImageUrlSchema.nullable().optional(),
  sourceConvo: z.string().max(300).nullable().optional(),
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

// ---------- v2: projects & threads ----------

export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#777169"),
  sortOrder: z.number().int().default(0), // sidebar drag order
  teamId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectCreateSchema = ProjectSchema.pick({ name: true }).extend({
  color: ProjectSchema.shape.color.optional(),
  teamId: z.string().nullable().optional(),
});
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ThreadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  title: z.string().min(1).max(200),
  finalOutput: z.string().max(50_000).nullable().default(null),
  finalImage: ImageUrlSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Thread = z.infer<typeof ThreadSchema>;

export const ThreadCreateSchema = ThreadSchema.pick({ title: true }).extend({
  projectId: z.string().nullable().optional(),
  promptIds: z.array(z.string()).max(50).optional(), // initial steps, in order
});
export type ThreadCreate = z.infer<typeof ThreadCreateSchema>;

export const ThreadUpdateSchema = z.object({
  title: ThreadSchema.shape.title.optional(),
  projectId: z.string().nullable().optional(),
  finalOutput: z.string().max(50_000).nullable().optional(),
  finalImage: ImageUrlSchema.nullable().optional(),
  promptIds: z.array(z.string()).max(50).optional(), // full reorder/replace
});
export type ThreadUpdate = z.infer<typeof ThreadUpdateSchema>;

// ---------- estimated token usage ----------

// deltas pushed by the extension; server increments. Everything here is an
// ESTIMATE (message chars ÷ 4) — the UI must always say "estimated".
export const UsagePushSchema = z.object({
  entries: z
    .array(
      z.object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        site: z.string().min(1).max(30),
        tokens: z.number().int().min(1).max(5_000_000),
      }),
    )
    .min(1)
    .max(200),
});
export type UsagePush = z.infer<typeof UsagePushSchema>;

// individual message-send events — the limit tracker's raw data. The server
// stores them so counts survive refreshes, reinstalls, and device switches.
export const UsageEventsSchema = z.object({
  events: z
    .array(
      z.object({
        site: z.string().min(1).max(30),
        at: z.number().int().positive(), // epoch ms, client clock
      }),
    )
    .min(1)
    .max(100),
});
export type UsageEvents = z.infer<typeof UsageEventsSchema>;

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
