-- Production-safe idempotent repair for deployments where application code was
-- released before the offer-publication migration was applied.  Do not remove
-- the original 0082 migration; normal environments apply it first.
ALTER TABLE "store_offer_collections"
  ADD COLUMN IF NOT EXISTS "offer_product_id" uuid REFERENCES "products"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "offer_variant_id" uuid REFERENCES "product_variants"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "publication_target" varchar(40),
  ADD COLUMN IF NOT EXISTS "publication_state" varchar(40),
  ADD COLUMN IF NOT EXISTS "review_requested_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "storefront_published_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "homepage_approved_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "store_offer_collections_offer_product_unique"
  ON "store_offer_collections" ("offer_product_id");
CREATE INDEX IF NOT EXISTS "store_offer_collections_publication_idx"
  ON "store_offer_collections" ("publication_target", "publication_state", "starts_at", "ends_at");

-- Compatibility state for rows created before the explicit publication model.
UPDATE "store_offer_collections"
SET "publication_target" = 'homepage',
    "publication_state" = CASE
      WHEN "status" = 'approved' THEN 'homepage_approved'
      WHEN "status" = 'pending_review' THEN 'homepage_review'
      WHEN "status" = 'rejected' THEN 'rejected'
      WHEN "status" = 'disabled' THEN 'paused'
      ELSE 'draft'
    END
WHERE "publication_target" IS NULL OR "publication_state" IS NULL;

-- Rollback only after code no longer reads these columns:
-- DROP INDEX IF EXISTS "store_offer_collections_publication_idx";
-- DROP INDEX IF EXISTS "store_offer_collections_offer_product_unique";
-- ALTER TABLE "store_offer_collections"
--   DROP COLUMN IF EXISTS "homepage_approved_at",
--   DROP COLUMN IF EXISTS "storefront_published_at",
--   DROP COLUMN IF EXISTS "review_requested_at",
--   DROP COLUMN IF EXISTS "publication_state",
--   DROP COLUMN IF EXISTS "publication_target",
--   DROP COLUMN IF EXISTS "offer_variant_id",
--   DROP COLUMN IF EXISTS "offer_product_id";
