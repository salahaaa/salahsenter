-- 0019_core_architecture_indexes.sql
-- Core Architecture Hardening: composite + covering indexes for the paginated,
-- filtered List queries introduced in the performance pass, and missing lookup
-- indexes for merchant-isolation checks. All statements are idempotent.

-- ── products: store-scoped list+filter (the merchant dashboard's hottest query) ──
CREATE INDEX IF NOT EXISTS products_store_status_idx ON products (store_id, status);
CREATE INDEX IF NOT EXISTS products_store_created_at_idx ON products (store_id, created_at DESC);

-- ── orders: role-scoped list (merchant / customer) + status filter ──
CREATE INDEX IF NOT EXISTS orders_store_status_idx ON orders (store_id, status_code);
CREATE INDEX IF NOT EXISTS orders_customer_created_at_idx ON orders (customer_id, created_at DESC);

-- ── stores: admin filtering by status (low-cardinality → partial-friendly) ──
CREATE INDEX IF NOT EXISTS stores_status_idx ON stores (status);

-- ── merchant_applications: open-application ownership check + admin ordering ──
CREATE INDEX IF NOT EXISTS merchant_applications_applicant_idx ON merchant_applications (applicant_user_id);
CREATE INDEX IF NOT EXISTS merchant_applications_created_at_idx ON merchant_applications (created_at DESC);

-- ── inventory_movements: store-scoped movement history (already has store_idx,
--    this composite covers the common "store + newest" pagination) ──
CREATE INDEX IF NOT EXISTS inventory_movements_store_created_at_idx ON inventory_movements (store_id, created_at DESC);

-- ── product_variants: lookup by store via product join is covered; ensure low-stock
--    scans used by dashboards hit an index on (low_stock_threshold) — already present. ──

-- Verification snapshot
SELECT 'indexes added' AS status;
