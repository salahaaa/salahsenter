-- Onboarding-selected sector is copied to the approved store and scopes its
-- activity-template suggestions.  NULL is intentionally retained for legacy
-- applications/stores so this migration never reclassifies existing merchants.
ALTER TABLE "merchant_applications"
  ADD COLUMN IF NOT EXISTS "activity_template_key" varchar(160);

ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "activity_template_key" varchar(160);

CREATE INDEX IF NOT EXISTS "merchant_applications_activity_template_idx"
  ON "merchant_applications" ("activity_template_key");

CREATE INDEX IF NOT EXISTS "stores_activity_template_idx"
  ON "stores" ("activity_template_key");

-- Rollback (only after deploying application code that no longer reads these
-- fields):
-- DROP INDEX IF EXISTS "stores_activity_template_idx";
-- DROP INDEX IF EXISTS "merchant_applications_activity_template_idx";
-- ALTER TABLE "stores" DROP COLUMN IF EXISTS "activity_template_key";
-- ALTER TABLE "merchant_applications" DROP COLUMN IF EXISTS "activity_template_key";
