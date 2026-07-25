-- Merchant-controlled store operation status and business hours.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "operation_status" varchar(40) DEFAULT 'OPEN' NOT NULL;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "operation_note" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "business_hours" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "operation_status_updated_at" timestamp with time zone;

UPDATE "stores"
SET "operation_status" = 'OPEN'
WHERE "operation_status" IS NULL OR "operation_status" NOT IN ('OPEN','CLOSED','VACATION','PAUSED');

DO $$ BEGIN
 ALTER TABLE "stores" ADD CONSTRAINT "stores_operation_status_check" CHECK ("operation_status" IN ('OPEN','CLOSED','VACATION','PAUSED'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "stores_operation_status_idx" ON "stores" ("operation_status", "status", "is_active");
