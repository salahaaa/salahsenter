-- Store offer item quantities for bundle offers.
-- Allows a merchant to create bundles like: 3 oil cans + 2 rice packs + 3 serving plates.
ALTER TABLE "store_offer_items" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1 NOT NULL;
UPDATE "store_offer_items" SET "quantity" = 1 WHERE "quantity" IS NULL OR "quantity" < 1;
