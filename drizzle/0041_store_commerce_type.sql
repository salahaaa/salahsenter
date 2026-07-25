-- Store commerce mode: full online sales or showcase-only.
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "store_commerce_type" varchar(40) DEFAULT 'ONLINE_SALES' NOT NULL;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "store_commerce_type" varchar(40) DEFAULT 'ONLINE_SALES' NOT NULL;

UPDATE "merchant_applications"
SET "store_commerce_type" = 'ONLINE_SALES'
WHERE "store_commerce_type" IS NULL OR "store_commerce_type" NOT IN ('ONLINE_SALES', 'SHOWCASE_ONLY');

UPDATE "stores"
SET "store_commerce_type" = 'ONLINE_SALES'
WHERE "store_commerce_type" IS NULL OR "store_commerce_type" NOT IN ('ONLINE_SALES', 'SHOWCASE_ONLY');

DO $$ BEGIN
 ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_store_commerce_type_check" CHECK ("store_commerce_type" IN ('ONLINE_SALES','SHOWCASE_ONLY'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "stores" ADD CONSTRAINT "stores_store_commerce_type_check" CHECK ("store_commerce_type" IN ('ONLINE_SALES','SHOWCASE_ONLY'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "stores_commerce_type_idx" ON "stores" ("store_commerce_type", "status", "is_active");
