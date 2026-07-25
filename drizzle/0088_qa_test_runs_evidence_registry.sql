-- Parallel QA evidence registry. Test accounts submit only their own results;
-- administrators review the consolidated evidence and failures.
CREATE TABLE IF NOT EXISTS "qa_test_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_key" varchar(120) NOT NULL,
  "environment" varchar(40) NOT NULL DEFAULT 'staging',
  "category" varchar(80) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'planned',
  "severity" varchar(30) NOT NULL DEFAULT 'info',
  "executor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "evidence_url" text,
  "note" text,
  "failure_summary" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "qa_test_runs_status_check" CHECK ("status" IN ('planned', 'running', 'passed', 'failed', 'blocked')),
  CONSTRAINT "qa_test_runs_severity_check" CHECK ("severity" IN ('info', 'warning', 'critical'))
);
CREATE INDEX IF NOT EXISTS "qa_test_runs_case_status_idx" ON "qa_test_runs" ("case_key", "status", "created_at");
CREATE INDEX IF NOT EXISTS "qa_test_runs_environment_status_idx" ON "qa_test_runs" ("environment", "status", "created_at");
CREATE INDEX IF NOT EXISTS "qa_test_runs_executor_idx" ON "qa_test_runs" ("executor_user_id", "created_at");

-- Rollback after application code no longer reads qa_test_runs:
-- DROP TABLE IF EXISTS "qa_test_runs";
