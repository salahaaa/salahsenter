-- Sponsored advertising telemetry: privacy-aware visitor hashes, placement attribution,
-- deterministic event keys and indexes for deduplication/frequency controls.
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "visitor_hash" varchar(128);
ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "event_key" varchar(180);
CREATE INDEX IF NOT EXISTS "ad_impressions_campaign_visitor_idx" ON "ad_impressions" ("campaign_id", "visitor_hash", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "ad_impressions_event_key_unique" ON "ad_impressions" ("event_key");

ALTER TABLE "ad_clicks" ADD COLUMN IF NOT EXISTS "visitor_hash" varchar(128);
ALTER TABLE "ad_clicks" ADD COLUMN IF NOT EXISTS "placement" varchar(80) DEFAULT 'unknown' NOT NULL;
ALTER TABLE "ad_clicks" ADD COLUMN IF NOT EXISTS "event_key" varchar(180);
CREATE INDEX IF NOT EXISTS "ad_clicks_campaign_visitor_idx" ON "ad_clicks" ("campaign_id", "visitor_hash", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "ad_clicks_event_key_unique" ON "ad_clicks" ("event_key");
