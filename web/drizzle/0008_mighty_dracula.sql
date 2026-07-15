ALTER TABLE "projects" ALTER COLUMN "color" SET DEFAULT '#777169';--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;