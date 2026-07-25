CREATE TABLE IF NOT EXISTS "admin_promotional_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(180) NOT NULL,
  "slug" varchar(220) NOT NULL,
  "category" varchar(80) DEFAULT 'admin' NOT NULL,
  "description" text,
  "image_url" text,
  "video_url" text,
  "contact_name" varchar(160),
  "contact_phone" varchar(60),
  "whatsapp_url" text,
  "location_text" text,
  "external_url" text,
  "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "content_status" DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "is_featured" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "admin_promotional_offers" ADD CONSTRAINT "admin_promotional_offers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_promotional_offers_slug_unique" ON "admin_promotional_offers" ("slug");
CREATE INDEX IF NOT EXISTS "admin_promotional_offers_status_idx" ON "admin_promotional_offers" ("status", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "admin_promotional_offers_featured_idx" ON "admin_promotional_offers" ("is_featured", "sort_order");
