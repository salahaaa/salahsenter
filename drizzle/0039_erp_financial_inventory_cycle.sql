-- ERP source-of-truth financial and inventory cycle.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "reserved_quantity" integer DEFAULT 0 NOT NULL;
UPDATE "product_variants" SET "reserved_quantity" = greatest("reserved_quantity", 0) WHERE "reserved_quantity" < 0;
CREATE INDEX IF NOT EXISTS "product_variants_available_stock_idx" ON "product_variants" (("stock_quantity" - "reserved_quantity"), "low_stock_threshold");

ALTER TABLE "order_invoices" ADD COLUMN IF NOT EXISTS "external_invoice_id" varchar(180);
ALTER TABLE "order_invoices" ADD COLUMN IF NOT EXISTS "source_system" varchar(120) DEFAULT 'salah_center' NOT NULL;
ALTER TABLE "order_invoices" ADD COLUMN IF NOT EXISTS "erp_posted_at" timestamp with time zone;
ALTER TABLE "order_invoices" ADD COLUMN IF NOT EXISTS "integration_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS "order_invoices_external_idx" ON "order_invoices" ("source_system", "external_invoice_id");

-- Existing rows remain as legacy Salah Center invoices; new checkout flow no longer creates invoices directly.
UPDATE "order_invoices" SET "source_system" = 'salah_center' WHERE "source_system" IS NULL;
