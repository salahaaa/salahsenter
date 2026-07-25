-- Explicit dead-letter queue metadata for exhausted background jobs.
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "dead_lettered_at" timestamp with time zone;
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "dead_letter_reason" text;
CREATE INDEX IF NOT EXISTS "background_jobs_dead_letter_idx" ON "background_jobs" ("status", "dead_lettered_at") WHERE "status" = 'dead_letter';
