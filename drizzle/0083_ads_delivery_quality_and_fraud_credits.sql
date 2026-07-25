-- Advertising delivery quality, explicit currency, and immutable fraud credits.
ALTER TABLE "ad_campaigns"
  ADD COLUMN IF NOT EXISTS "currency" varchar(10) NOT NULL DEFAULT 'YER';

ALTER TABLE "ad_impressions"
  ADD COLUMN IF NOT EXISTS "quality_status" varchar(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "fraud_score" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ip_address" varchar(80),
  ADD COLUMN IF NOT EXISTS "user_agent" text;

CREATE INDEX IF NOT EXISTS "ad_impressions_campaign_quality_idx"
  ON "ad_impressions" ("campaign_id", "quality_status", "created_at");

CREATE TABLE IF NOT EXISTS "ad_credit_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "billing_id" uuid NOT NULL REFERENCES "ad_billing"("id") ON DELETE restrict,
  "campaign_id" uuid NOT NULL REFERENCES "ad_campaigns"("id") ON DELETE cascade,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "invoice_id" uuid REFERENCES "ad_invoices"("id") ON DELETE set null,
  "amount" numeric(14, 2) NOT NULL,
  "currency" varchar(10) NOT NULL DEFAULT 'YER',
  "status" varchar(40) NOT NULL DEFAULT 'issued',
  "reason" text NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "settled_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ad_credit_notes_billing_unique" ON "ad_credit_notes" ("billing_id");
CREATE INDEX IF NOT EXISTS "ad_credit_notes_campaign_status_idx" ON "ad_credit_notes" ("campaign_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "ad_credit_notes_store_status_idx" ON "ad_credit_notes" ("store_id", "status");

-- Rollback after application code no longer reads these fields/tables:
-- DROP TABLE IF EXISTS "ad_credit_notes";
-- DROP INDEX IF EXISTS "ad_impressions_campaign_quality_idx";
-- ALTER TABLE "ad_impressions" DROP COLUMN IF EXISTS "user_agent", DROP COLUMN IF EXISTS "ip_address", DROP COLUMN IF EXISTS "fraud_score", DROP COLUMN IF EXISTS "quality_status";
-- ALTER TABLE "ad_campaigns" DROP COLUMN IF EXISTS "currency";
