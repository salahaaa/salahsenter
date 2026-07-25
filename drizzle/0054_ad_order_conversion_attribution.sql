-- Privacy-aware conversion attribution from a sponsored click to an order.
CREATE TABLE IF NOT EXISTS "ad_order_attributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "click_id" uuid,
  "store_id" uuid NOT NULL,
  "customer_id" uuid,
  "attribution_token" varchar(80) NOT NULL,
  "placement" varchar(80) DEFAULT 'unknown' NOT NULL,
  "conversion_value" numeric(14,2) DEFAULT '0' NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "status" varchar(40) DEFAULT 'created' NOT NULL,
  "clicked_at" timestamp with time zone,
  "attributed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "ad_order_attributions" ADD CONSTRAINT "ad_order_attributions_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ad_order_attributions" ADD CONSTRAINT "ad_order_attributions_campaign_fk" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ad_order_attributions" ADD CONSTRAINT "ad_order_attributions_click_fk" FOREIGN KEY ("click_id") REFERENCES "ad_clicks"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ad_order_attributions" ADD CONSTRAINT "ad_order_attributions_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ad_order_attributions" ADD CONSTRAINT "ad_order_attributions_customer_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "ad_order_attributions_order_unique" ON "ad_order_attributions" ("order_id");
CREATE INDEX IF NOT EXISTS "ad_order_attributions_campaign_idx" ON "ad_order_attributions" ("campaign_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "ad_order_attributions_store_idx" ON "ad_order_attributions" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "ad_order_attributions_token_idx" ON "ad_order_attributions" ("attribution_token");
