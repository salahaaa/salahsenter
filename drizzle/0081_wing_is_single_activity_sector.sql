-- The public mall wing is the single sector selector in merchant onboarding.
-- The linked template key is intentionally a logical key: it may refer to a
-- system template or an active admin-managed catalogue template.
ALTER TABLE "wings"
  ADD COLUMN IF NOT EXISTS "activity_template_key" varchar(160);

CREATE INDEX IF NOT EXISTS "wings_activity_template_idx"
  ON "wings" ("activity_template_key");

-- Safe bootstrap for the repository's original seed wings only.  Other wings
-- stay NULL and are deliberately excluded from the merchant application form
-- until an admin explicitly assigns their one template in Admin > Wings.
UPDATE "wings"
SET "activity_template_key" = CASE "name"
  WHEN 'السوبرات' THEN 'grocery'
  WHEN 'الإلكترونيات' THEN 'electronics'
  WHEN 'الأزياء' THEN 'fashion'
  WHEN 'الصيدليات' THEN 'pharmacy'
  WHEN 'المطاعم' THEN 'restaurant'
  WHEN 'مواد البناء' THEN 'hardware-building'
  ELSE "activity_template_key"
END
WHERE "activity_template_key" IS NULL
  AND "name" IN ('السوبرات', 'الإلكترونيات', 'الأزياء', 'الصيدليات', 'المطاعم', 'مواد البناء');

-- Rollback (only after deploying application code that no longer reads this
-- field):
-- DROP INDEX IF EXISTS "wings_activity_template_idx";
-- ALTER TABLE "wings" DROP COLUMN IF EXISTS "activity_template_key";
