-- Scheduled finance/reconciliation reports with durable delivery evidence.
CREATE TABLE IF NOT EXISTS "scheduled_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(180) NOT NULL, "report_type" varchar(80) DEFAULT 'financial_summary' NOT NULL,
  "frequency" varchar(30) DEFAULT 'daily' NOT NULL, "timezone" varchar(80) DEFAULT 'Asia/Aden' NOT NULL,
  "recipients" jsonb DEFAULT '[]'::jsonb NOT NULL, "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_format" varchar(20) DEFAULT 'csv' NOT NULL, "is_active" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp with time zone, "next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "scheduled_reports_due_idx" ON "scheduled_reports" ("is_active", "next_run_at");
CREATE INDEX IF NOT EXISTS "scheduled_reports_type_idx" ON "scheduled_reports" ("report_type");

CREATE TABLE IF NOT EXISTS "scheduled_report_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "report_id" uuid NOT NULL,
  "status" varchar(30) DEFAULT 'queued' NOT NULL, "recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL, "output_format" varchar(20) DEFAULT 'csv' NOT NULL,
  "error" text, "generated_at" timestamp with time zone, "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "scheduled_report_deliveries" ADD CONSTRAINT "scheduled_report_deliveries_report_fk" FOREIGN KEY ("report_id") REFERENCES "scheduled_reports"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "scheduled_report_deliveries_report_idx" ON "scheduled_report_deliveries" ("report_id", "created_at");
CREATE INDEX IF NOT EXISTS "scheduled_report_deliveries_status_idx" ON "scheduled_report_deliveries" ("status", "created_at");
