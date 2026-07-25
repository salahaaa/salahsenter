-- Commerce funnel events: privacy-aware product/checkout/order measurement.
CREATE TABLE IF NOT EXISTS "commerce_funnel_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" varchar(60) NOT NULL,
  "visitor_hash" varchar(128),
  "user_id" uuid,
  "store_id" uuid,
  "product_id" uuid,
  "order_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "commerce_funnel_events" ADD CONSTRAINT "commerce_funnel_events_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "commerce_funnel_events" ADD CONSTRAINT "commerce_funnel_events_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "commerce_funnel_events" ADD CONSTRAINT "commerce_funnel_events_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "commerce_funnel_events" ADD CONSTRAINT "commerce_funnel_events_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "commerce_funnel_events_event_created_idx" ON "commerce_funnel_events" ("event_type", "created_at");
CREATE INDEX IF NOT EXISTS "commerce_funnel_events_store_created_idx" ON "commerce_funnel_events" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "commerce_funnel_events_product_created_idx" ON "commerce_funnel_events" ("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "commerce_funnel_events_visitor_created_idx" ON "commerce_funnel_events" ("visitor_hash", "created_at");
