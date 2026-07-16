import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============ Better Auth tables ============

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ App tables ============

export const visibilityEnum = pgEnum("visibility", ["private", "team", "public"]);
export const teamRoleEnum = pgEnum("team_role", ["owner", "member"]);

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const teamInvites = pgTable(
  "team_invites",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("team_invites_team_email_idx").on(t.teamId, t.email)],
);

// ---- v2: projects shelve threads; threads chain saved prompts ----

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#777169"),
    sortOrder: integer("sort_order").notNull().default(0), // sidebar drag order
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    finalOutput: text("final_output"),
    finalImage: text("final_image"),
    // recipes can be published to /r/[id] — only private|public used (no team)
    visibility: visibilityEnum("visibility").notNull().default("private"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("threads_user_idx").on(t.userId),
    index("threads_project_idx").on(t.projectId),
  ],
);

export const threadSteps = pgTable(
  "thread_steps",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    promptId: text("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.promptId] })],
);

// ---- v2 P4: estimated token usage, one row per user/day/site ----
// tokens are ESTIMATES (message chars ÷ 4) pushed as deltas by the extension

export const usageDays = pgTable(
  "usage_days",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD
    site: text("site").notNull(), // chatgpt | claude | gemini | …
    tokens: integer("tokens").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.site] })],
);

// individual message-send events for the on-page limit widget — rolling-window
// counts need timestamps, and storing them server-side is what makes the
// tracker survive refreshes and work across devices. Rows self-prune (48h).
export const usageMessages = pgTable(
  "usage_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    site: text("site").notNull(),
    at: timestamp("at").notNull(),
  },
  (t) => [index("usage_messages_user_site_at_idx").on(t.userId, t.site, t.at)],
);

// gallery bookmarks — a reading list, NOT a copy ("add to my diary" clones;
// a bookmark just remembers)
export const galleryBookmarks = pgTable(
  "gallery_bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    promptId: text("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.promptId] })],
);

export const folders = pgTable(
  "folders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    sortOrder: integer("sort_order").notNull().default(0), // sidebar drag order
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("folders_user_idx").on(t.userId)],
);

export const prompts = pgTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default([]),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    useCount: integer("use_count").notNull().default(0),
    pinned: boolean("pinned").notNull().default(false),
    deleted: boolean("deleted").notNull().default(false),
    // gallery prompt this was copied from — dedupes "add to my diary"
    sourceId: text("source_id"),
    // sample outputs: what the model produced before/after this prompt —
    // the before/after panes in the detail view
    outputBefore: text("output_before"),
    outputAfter: text("output_after"),
    // cloudinary screenshot URLs — panes can hold text, an image, or both
    imageBefore: text("image_before"),
    imageAfter: text("image_after"),
    // conversation fingerprint stamped by the extension — powers backward
    // thread assembly ("5 saves from this chat → chain into a thread?")
    sourceConvo: text("source_convo"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // "team visibility requires team_id" is enforced in the API layer, not as a
  // DB check: the FK's on-delete-set-null on team_id would violate a check
  // whenever a team (or its owner) is deleted.
  (t) => [
    index("prompts_user_idx").on(t.userId),
    index("prompts_team_idx").on(t.teamId),
    index("prompts_visibility_idx").on(t.visibility),
    uniqueIndex("prompts_user_source_idx")
      .on(t.userId, t.sourceId)
      .where(sql`${t.sourceId} IS NOT NULL`),
  ],
);
