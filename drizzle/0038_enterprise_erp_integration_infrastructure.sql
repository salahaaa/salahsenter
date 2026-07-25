-- Enterprise ERP Integration Infrastructure: mapping profiles, entity links and sync runs.
CREATE TABLE IF NOT EXISTS "integration_mapping_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_key" varchar(120) NOT NULL,
  "store_id" uuid,
  "name" varchar(180) NOT NULL,
  "system_type" varchar(80) DEFAULT 'generic' NOT NULL,
  "resource" varchar(80) NOT NULL,
  "direction" varchar(40) DEFAULT 'bidirectional' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_of_truth" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "conflict_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "integration_mapping_profiles" ADD CONSTRAINT "integration_mapping_profiles_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "integration_mapping_profiles" ADD CONSTRAINT "integration_mapping_profiles_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "integration_mapping_profiles_client_resource_idx" ON "integration_mapping_profiles" ("client_key", "resource", "is_active");
CREATE INDEX IF NOT EXISTS "integration_mapping_profiles_store_idx" ON "integration_mapping_profiles" ("store_id", "resource");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_mapping_profiles_client_resource_version_unique" ON "integration_mapping_profiles" ("client_key", "resource", "version");

CREATE TABLE IF NOT EXISTS "integration_entity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(80) DEFAULT 'accounting' NOT NULL,
  "client_key" varchar(120) NOT NULL,
  "store_id" uuid,
  "entity_type" varchar(80) NOT NULL,
  "platform_entity_id" varchar(160),
  "external_entity_id" varchar(180) NOT NULL,
  "external_code" varchar(180),
  "external_fingerprint" varchar(180),
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "last_synced_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "integration_entity_links" ADD CONSTRAINT "integration_entity_links_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "integration_entity_links_external_unique" ON "integration_entity_links" ("client_key", "entity_type", "external_entity_id");
CREATE INDEX IF NOT EXISTS "integration_entity_links_platform_idx" ON "integration_entity_links" ("entity_type", "platform_entity_id");
CREATE INDEX IF NOT EXISTS "integration_entity_links_store_idx" ON "integration_entity_links" ("store_id", "entity_type");
CREATE INDEX IF NOT EXISTS "integration_entity_links_code_idx" ON "integration_entity_links" ("client_key", "entity_type", "external_code");

CREATE TABLE IF NOT EXISTS "integration_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_key" varchar(120) NOT NULL,
  "device_id" varchar(160),
  "store_id" uuid,
  "resource" varchar(80) NOT NULL,
  "direction" varchar(40) NOT NULL,
  "status" varchar(40) DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "counters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "checkpoint" varchar(220),
  "error" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "integration_sync_runs_client_started_idx" ON "integration_sync_runs" ("client_key", "started_at");
CREATE INDEX IF NOT EXISTS "integration_sync_runs_store_resource_idx" ON "integration_sync_runs" ("store_id", "resource", "status");
CREATE INDEX IF NOT EXISTS "integration_sync_runs_device_idx" ON "integration_sync_runs" ("device_id", "started_at");
