CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "queue" varchar(80) DEFAULT 'default' NOT NULL,
  "type" varchar(120) NOT NULL,
  "status" varchar(30) DEFAULT 'queued' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_until" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "last_error" text,
  "dedupe_key" varchar(180),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "background_jobs_queue_status_idx" ON "background_jobs" ("queue", "status", "available_at");
CREATE INDEX IF NOT EXISTS "background_jobs_type_idx" ON "background_jobs" ("type");
CREATE INDEX IF NOT EXISTS "background_jobs_locked_idx" ON "background_jobs" ("status", "locked_until");
CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_queue_dedupe_unique" ON "background_jobs" ("queue", "dedupe_key");
