-- The merchant proposal is never the final booking. These fields preserve the
-- admin-controlled placement and schedule used to create a campaign.
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "approved_placement_id" varchar(80);
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "approved_starts_at" timestamp with time zone;
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "approved_ends_at" timestamp with time zone;
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "approved_visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS "home_exposure_requests_approved_window_idx" ON "home_exposure_requests" ("approved_placement_id", "approved_starts_at", "approved_ends_at");
