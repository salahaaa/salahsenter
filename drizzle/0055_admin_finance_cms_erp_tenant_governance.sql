-- Phase 4/5 governance: unified work assignments, CMS versions, financial close,
-- ERP certification and verifiable white-label domain onboarding.
CREATE TABLE IF NOT EXISTS "admin_work_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_key" varchar(220) NOT NULL,
  "entity_type" varchar(120) NOT NULL,
  "entity_id" varchar(160) NOT NULL,
  "queue" varchar(80) DEFAULT 'general' NOT NULL,
  "status" varchar(40) DEFAULT 'open' NOT NULL,
  "priority" varchar(20) DEFAULT 'normal' NOT NULL,
  "assigned_to" uuid,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "admin_work_assignments" ADD CONSTRAINT "admin_work_assignments_assigned_to_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "admin_work_assignments" ADD CONSTRAINT "admin_work_assignments_assigned_by_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "admin_work_assignments_work_key_unique" ON "admin_work_assignments" ("work_key");
CREATE INDEX IF NOT EXISTS "admin_work_assignments_assignee_idx" ON "admin_work_assignments" ("assigned_to", "status", "due_at");
CREATE INDEX IF NOT EXISTS "admin_work_assignments_queue_idx" ON "admin_work_assignments" ("queue", "status", "priority");

CREATE TABLE IF NOT EXISTS "cms_page_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cms_page_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "change_note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_page_fk" FOREIGN KEY ("cms_page_id") REFERENCES "cms_pages"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "cms_page_versions_page_version_unique" ON "cms_page_versions" ("cms_page_id", "version");
CREATE INDEX IF NOT EXISTS "cms_page_versions_page_created_idx" ON "cms_page_versions" ("cms_page_id", "created_at");

CREATE TABLE IF NOT EXISTS "financial_close_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "discrepancies" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "note" text,
  "prepared_by" uuid,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "closed_by" uuid,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "financial_close_runs" ADD CONSTRAINT "financial_close_runs_prepared_by_fk" FOREIGN KEY ("prepared_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "financial_close_runs" ADD CONSTRAINT "financial_close_runs_reviewed_by_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "financial_close_runs" ADD CONSTRAINT "financial_close_runs_closed_by_fk" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "financial_close_runs_period_unique" ON "financial_close_runs" ("period_start", "period_end");
CREATE INDEX IF NOT EXISTS "financial_close_runs_status_idx" ON "financial_close_runs" ("status", "period_end");

CREATE TABLE IF NOT EXISTS "erp_connector_certifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "integration_client_id" uuid NOT NULL,
  "store_id" uuid,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "note" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "certified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "erp_connector_certifications" ADD CONSTRAINT "erp_connector_certifications_client_fk" FOREIGN KEY ("integration_client_id") REFERENCES "integration_clients"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "erp_connector_certifications" ADD CONSTRAINT "erp_connector_certifications_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "erp_connector_certifications" ADD CONSTRAINT "erp_connector_certifications_reviewed_by_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "erp_connector_certifications_client_unique" ON "erp_connector_certifications" ("integration_client_id");
CREATE INDEX IF NOT EXISTS "erp_connector_certifications_store_idx" ON "erp_connector_certifications" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "erp_connector_certifications_status_idx" ON "erp_connector_certifications" ("status", "updated_at");

ALTER TABLE "tenant_domains" ADD COLUMN IF NOT EXISTS "verification_token" varchar(180);
