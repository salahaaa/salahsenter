-- Central, locale-ready text catalog. Values are versioned so an administrator
-- can save a draft, preview it, publish it, and restore any prior publication.
CREATE TABLE IF NOT EXISTS "platform_text_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "text_key" varchar(220) NOT NULL,
  "namespace" varchar(80) NOT NULL,
  "audience" varchar(40) NOT NULL DEFAULT 'all',
  "description" text NOT NULL DEFAULT '',
  "is_editable" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_text_entries_key_unique" ON "platform_text_entries" ("text_key");
CREATE INDEX IF NOT EXISTS "platform_text_entries_namespace_idx" ON "platform_text_entries" ("namespace", "audience");

CREATE TABLE IF NOT EXISTS "platform_text_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entry_id" uuid NOT NULL REFERENCES "platform_text_entries"("id") ON DELETE cascade,
  "locale" varchar(20) NOT NULL DEFAULT 'ar',
  "value" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "version_number" integer NOT NULL,
  "change_note" varchar(500),
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "published_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "published_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_text_versions_entry_locale_version_unique" ON "platform_text_versions" ("entry_id", "locale", "version_number");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_text_versions_one_published_per_locale" ON "platform_text_versions" ("entry_id", "locale") WHERE "status" = 'published';
CREATE INDEX IF NOT EXISTS "platform_text_versions_entry_locale_status_idx" ON "platform_text_versions" ("entry_id", "locale", "status", "created_at" DESC);

-- Rollback only after application code no longer reads the text center:
-- DROP TABLE IF EXISTS "platform_text_versions";
-- DROP TABLE IF EXISTS "platform_text_entries";
