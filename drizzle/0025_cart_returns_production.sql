CREATE TABLE IF NOT EXISTS "shopping_carts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "shopping_carts_user_status_idx" ON "shopping_carts" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "shopping_carts_updated_idx" ON "shopping_carts" ("updated_at");

CREATE TABLE IF NOT EXISTS "shopping_cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cart_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price_snapshot" numeric(12,2),
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_cart_id_shopping_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "shopping_carts"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "shopping_cart_items_cart_variant_unique" ON "shopping_cart_items" ("cart_id", "variant_id");
CREATE INDEX IF NOT EXISTS "shopping_cart_items_cart_idx" ON "shopping_cart_items" ("cart_id");
CREATE INDEX IF NOT EXISTS "shopping_cart_items_store_idx" ON "shopping_cart_items" ("store_id");
CREATE INDEX IF NOT EXISTS "shopping_cart_items_product_idx" ON "shopping_cart_items" ("product_id");

CREATE TABLE IF NOT EXISTS "return_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "status" varchar(40) DEFAULT 'requested' NOT NULL,
  "reason" varchar(120) NOT NULL,
  "description" text,
  "resolution" text,
  "refund_amount" numeric(12,2),
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "received_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "return_requests_order_idx" ON "return_requests" ("order_id", "status");
CREATE INDEX IF NOT EXISTS "return_requests_customer_idx" ON "return_requests" ("customer_id", "status");
CREATE INDEX IF NOT EXISTS "return_requests_store_idx" ON "return_requests" ("store_id", "status");

CREATE TABLE IF NOT EXISTS "return_request_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "return_request_id" uuid NOT NULL,
  "order_item_id" uuid NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "reason" varchar(160),
  "condition" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "return_request_items_return_idx" ON "return_request_items" ("return_request_id");
CREATE INDEX IF NOT EXISTS "return_request_items_order_item_idx" ON "return_request_items" ("order_item_id");
