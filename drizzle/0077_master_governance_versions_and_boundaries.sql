-- Master Governance Center history. Master settings remain isolated from every
-- other system_settings group.
CREATE TABLE IF NOT EXISTS "master_settings_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" integer NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reason" text,
  "based_on_version_id" uuid REFERENCES "master_settings_versions"("id") ON DELETE set null,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "master_settings_versions_version_unique" ON "master_settings_versions" ("version");
CREATE INDEX IF NOT EXISTS "master_settings_versions_status_created_idx" ON "master_settings_versions" ("status", "created_at");
