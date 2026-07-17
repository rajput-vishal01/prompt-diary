import type { MetadataRoute } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, threads } from "@/db/schema";

const SITE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// regenerate at most hourly — the public catalog doesn't need to be
// second-fresh and this keeps the DB off the crawler's hot path
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/gallery`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // the public share pages ARE the long-tail SEO surface
  const [publicPrompts, publicThreads] = await Promise.all([
    db
      .select({ id: prompts.id, updatedAt: prompts.updatedAt })
      .from(prompts)
      .where(and(eq(prompts.visibility, "public"), eq(prompts.deleted, false)))
      .orderBy(desc(prompts.updatedAt))
      .limit(5000),
    db
      .select({ id: threads.id, updatedAt: threads.updatedAt })
      .from(threads)
      .where(eq(threads.visibility, "public"))
      .orderBy(desc(threads.updatedAt))
      .limit(5000),
  ]);

  return [
    ...staticPages,
    ...publicPrompts.map((p) => ({
      url: `${SITE_URL}/p/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...publicThreads.map((t) => ({
      url: `${SITE_URL}/r/${t.id}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
