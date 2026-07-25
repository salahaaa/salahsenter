-- Drizzle's postgres-js migrator applies pending migrations inside one
-- transaction. PostgreSQL rejects CREATE INDEX CONCURRENTLY in a transaction,
-- so these intentionally use regular transaction-safe index creation. Existing
-- databases that already recorded this migration do not re-run it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_slug_trgm_idx ON products USING gin (slug gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_product_code_trgm_idx ON products USING gin (product_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_barcode_trgm_idx ON products USING gin (barcode gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_english_name_trgm_idx ON products USING gin (english_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_brand_trgm_idx ON products USING gin (brand gin_trgm_ops);

CREATE INDEX IF NOT EXISTS stores_name_trgm_idx ON stores USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS stores_slug_trgm_idx ON stores USING gin (slug gin_trgm_ops);
CREATE INDEX IF NOT EXISTS stores_store_number_trgm_idx ON stores USING gin (store_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS stores_contact_phone_trgm_idx ON stores USING gin (contact_phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS wings_name_trgm_idx ON wings USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS wings_slug_trgm_idx ON wings USING gin (slug gin_trgm_ops);

CREATE INDEX IF NOT EXISTS categories_name_trgm_idx ON categories USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS categories_slug_trgm_idx ON categories USING gin (slug gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_variants_sku_trgm_idx ON product_variants USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_variants_barcode_trgm_idx ON product_variants USING gin (barcode gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_variants_title_trgm_idx ON product_variants USING gin (title gin_trgm_ops);
