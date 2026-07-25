ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "store_offer_collections" ADD COLUMN IF NOT EXISTS "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "admin_promotional_offers" ADD COLUMN IF NOT EXISTS "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "ad_campaigns" ADD COLUMN IF NOT EXISTS "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS "banners_visibility_schedule_idx" ON "banners" USING gin ("visibility_schedule");
CREATE INDEX IF NOT EXISTS "announcements_visibility_schedule_idx" ON "announcements" USING gin ("visibility_schedule");
CREATE INDEX IF NOT EXISTS "news_visibility_schedule_idx" ON "news" USING gin ("visibility_schedule");
CREATE INDEX IF NOT EXISTS "store_offer_collections_visibility_schedule_idx" ON "store_offer_collections" USING gin ("visibility_schedule");
CREATE INDEX IF NOT EXISTS "admin_promotional_offers_visibility_schedule_idx" ON "admin_promotional_offers" USING gin ("visibility_schedule");
CREATE INDEX IF NOT EXISTS "ad_campaigns_visibility_schedule_idx" ON "ad_campaigns" USING gin ("visibility_schedule");
