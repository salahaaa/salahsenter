-- Product-level commerce type: allow mixed stores where some products sell online and others are showcase-only.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_commerce_type" varchar(40) DEFAULT 'ONLINE_SALES' NOT NULL;
UPDATE "products"
SET "product_commerce_type" = 'ONLINE_SALES'
WHERE "product_commerce_type" IS NULL OR "product_commerce_type" NOT IN ('ONLINE_SALES', 'SHOWCASE_ONLY');
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_product_commerce_type_check" CHECK ("product_commerce_type" IN ('ONLINE_SALES','SHOWCASE_ONLY'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "products_commerce_type_idx" ON "products" ("store_id", "product_commerce_type", "status");
