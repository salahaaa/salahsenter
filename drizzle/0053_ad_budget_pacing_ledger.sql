-- CPC budget pacing ledger. Each billable ad event has one idempotent ledger row.
ALTER TABLE "ad_billing" ADD COLUMN IF NOT EXISTS "event_key" varchar(180);
ALTER TABLE "ad_billing" ADD COLUMN IF NOT EXISTS "billing_type" varchar(40) DEFAULT 'cpc' NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ad_billing_event_key_unique" ON "ad_billing" ("event_key");
CREATE INDEX IF NOT EXISTS "ad_billing_campaign_created_idx" ON "ad_billing" ("campaign_id", "created_at");
