CREATE TABLE "usage_days" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"site" text NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_days_user_id_day_site_pk" PRIMARY KEY("user_id","day","site")
);
--> statement-breakpoint
ALTER TABLE "usage_days" ADD CONSTRAINT "usage_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;