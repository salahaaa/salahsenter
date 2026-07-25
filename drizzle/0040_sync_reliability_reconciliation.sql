-- Sync reliability, idempotency visibility, failed sync queue, reservation expiry and audit logs.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reservation_status" varchar(40) DEFAULT 'none' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reservation_expires_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reservation_released_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "orders_reservation_idx" ON "orders" ("reservation_status", "reservation_expires_at");

CREATE TABLE IF NOT EXISTS "integration_failed_syncs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "integration_event_id" uuid,
  "sync_run_id" uuid,
  "client_key" varchar(120),
  "store_id" uuid,
  "resource" varchar(80) NOT NULL,
  "direction" varchar(40) NOT NULL,
  "failure_type" varchar(80) DEFAULT 'processing_error' NOT NULL,
  "status" varchar(40) DEFAULT 'open' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "next_retry_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "integration_failed_syncs" ADD CONSTRAINT "integration_failed_syncs_event_fk" FOREIGN KEY ("integration_event_id") REFERENCES "integration_events"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "integration_failed_syncs" ADD CONSTRAINT "integration_failed_syncs_run_fk" FOREIGN KEY ("sync_run_id") REFERENCES "integration_sync_runs"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "integration_failed_syncs" ADD CONSTRAINT "integration_failed_syncs_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "integration_failed_syncs_event_idx" ON "integration_failed_syncs" ("integration_event_id");
CREATE INDEX IF NOT EXISTS "integration_failed_syncs_status_idx" ON "integration_failed_syncs" ("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "integration_failed_syncs_client_idx" ON "integration_failed_syncs" ("client_key", "created_at");
CREATE INDEX IF NOT EXISTS "integration_failed_syncs_store_idx" ON "integration_failed_syncs" ("store_id", "status");

CREATE TABLE IF NOT EXISTS "integration_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_key" varchar(120),
  "device_id" varchar(160),
  "store_id" uuid,
  "action" varchar(120) NOT NULL,
  "entity_type" varchar(80),
  "entity_id" varchar(160),
  "status" varchar(40) DEFAULT 'success' NOT NULL,
  "request_id" varchar(160),
  "ip_address" varchar(80),
  "user_agent" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "integration_audit_logs_client_idx" ON "integration_audit_logs" ("client_key", "created_at");
CREATE INDEX IF NOT EXISTS "integration_audit_logs_store_idx" ON "integration_audit_logs" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "integration_audit_logs_action_idx" ON "integration_audit_logs" ("action", "status");
