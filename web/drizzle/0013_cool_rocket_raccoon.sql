ALTER TABLE "usage_days" ADD COLUMN "model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_days" DROP CONSTRAINT "usage_days_user_id_day_site_pk";--> statement-breakpoint
ALTER TABLE "usage_days" ADD CONSTRAINT "usage_days_user_id_day_site_model_pk" PRIMARY KEY("user_id","day","site","model");--> statement-breakpoint
ALTER TABLE "usage_messages" ADD COLUMN "reasoning" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_messages" ADD COLUMN "model" text DEFAULT '' NOT NULL;
