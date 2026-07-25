-- Request correlation joins API responses, structured logs and audit events.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "correlation_id" varchar(160);
CREATE INDEX IF NOT EXISTS "audit_logs_correlation_idx" ON "audit_logs" ("correlation_id", "created_at");
