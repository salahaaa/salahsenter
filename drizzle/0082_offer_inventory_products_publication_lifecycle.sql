-- A merchant offer becomes a real native inventory product.  Publication target
-- is separate from publication state so storefront publication never implies
-- homepage/public-platform publication.
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

-- Preserve the existing public behaviour of legacy approved offers. New
-- offers always receive explicit target/state from application code.
UPDATE "store_offer_collections"
SET "publication_target" = CASE WHEN "status" = 'approved' THEN 'homepage' ELSE 'homepage' END,
    "publication_state" = CASE
      WHEN "status" = 'approved' THEN 'homepage_approved'
      WHEN "status" = 'pending_review' THEN 'homepage_review'
      WHEN "status" = 'rejected' THEN 'rejected'
      WHEN "status" = 'disabled' THEN 'paused'
      ELSE 'draft'
    END,
    "review_requested_at" = CASE WHEN "status" = 'pending_review' THEN "created_at" ELSE NULL END,
    "homepage_approved_at" = CASE WHEN "status" = 'approved' THEN COALESCE("reviewed_at", "created_at") ELSE NULL END
WHERE "publication_target" IS NULL OR "publication_state" IS NULL;

CREATE TABLE IF NOT EXISTS "store_offer_order_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "offer_id" uuid NOT NULL REFERENCES "store_offer_collections"("id") ON DELETE restrict,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE restrict,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE restrict,
  "quantity" integer NOT NULL,
  "state" varchar(40) DEFAULT 'sold' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "restored_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "store_offer_order_allocations_order_offer_unique"
  ON "store_offer_order_allocations" ("order_id", "offer_id");
CREATE INDEX IF NOT EXISTS "store_offer_order_allocations_order_idx"
  ON "store_offer_order_allocations" ("order_id");
CREATE INDEX IF NOT EXISTS "store_offer_order_allocations_offer_state_idx"
  ON "store_offer_order_allocations" ("offer_id", "state");

-- Rollback (only after deploying code that no longer reads these fields):
-- DROP TABLE IF EXISTS "store_offer_order_allocations";
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
