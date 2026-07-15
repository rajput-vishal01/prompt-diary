CREATE TABLE "usage_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"site" text NOT NULL,
	"at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_messages" ADD CONSTRAINT "usage_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_messages_user_site_at_idx" ON "usage_messages" USING btree ("user_id","site","at");