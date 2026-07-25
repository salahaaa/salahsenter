-- Durable operational evidence for staging drills and release approval.
CREATE TABLE IF NOT EXISTS "operational_drills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "kind" varchar(80) NOT NULL,
  "environment" varchar(40) DEFAULT 'staging' NOT NULL, "status" varchar(30) DEFAULT 'planned' NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL, "note" text,
  "started_at" timestamp with time zone, "completed_at" timestamp with time zone, "executed_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "operational_drills" ADD CONSTRAINT "operational_drills_executed_by_fk" FOREIGN KEY ("executed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "operational_drills_env_kind_idx" ON "operational_drills" ("environment", "kind", "status");
CREATE INDEX IF NOT EXISTS "operational_drills_created_idx" ON "operational_drills" ("created_at");

CREATE TABLE IF NOT EXISTS "release_gate_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "environment" varchar(40) NOT NULL,
  "status" varchar(30) DEFAULT 'pending' NOT NULL, "readiness_score" integer,
  "checks" jsonb DEFAULT '{}'::jsonb NOT NULL, "source" varchar(80) DEFAULT 'admin' NOT NULL,
  "note" text, "executed_by" uuid, "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "release_gate_runs" ADD CONSTRAINT "release_gate_runs_executed_by_fk" FOREIGN KEY ("executed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "release_gate_runs_env_created_idx" ON "release_gate_runs" ("environment", "created_at");
CREATE INDEX IF NOT EXISTS "release_gate_runs_status_idx" ON "release_gate_runs" ("status", "created_at");
