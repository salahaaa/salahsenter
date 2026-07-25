-- Durable per-entity ERP conflict cases for manual resolution/audit.
CREATE TABLE IF NOT EXISTS "erp_conflict_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid, "client_key" varchar(120), "mapping_profile_id" uuid,
  "entity_type" varchar(80) NOT NULL, "platform_entity_id" varchar(160), "external_entity_id" varchar(180),
  "conflict_type" varchar(100) NOT NULL, "status" varchar(30) DEFAULT 'open' NOT NULL,
  "platform_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL, "external_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "resolution" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "assigned_to" uuid, "resolved_by" uuid, "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "erp_conflict_cases" ADD CONSTRAINT "erp_conflict_cases_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "erp_conflict_cases" ADD CONSTRAINT "erp_conflict_cases_mapping_fk" FOREIGN KEY ("mapping_profile_id") REFERENCES "integration_mapping_profiles"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "erp_conflict_cases" ADD CONSTRAINT "erp_conflict_cases_assigned_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "erp_conflict_cases" ADD CONSTRAINT "erp_conflict_cases_resolved_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "erp_conflict_cases_status_idx" ON "erp_conflict_cases" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "erp_conflict_cases_store_idx" ON "erp_conflict_cases" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "erp_conflict_cases_entity_idx" ON "erp_conflict_cases" ("entity_type", "platform_entity_id");
CREATE INDEX IF NOT EXISTS "erp_conflict_cases_external_idx" ON "erp_conflict_cases" ("client_key", "entity_type", "external_entity_id");
