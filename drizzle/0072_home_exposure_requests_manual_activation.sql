-- Merchant requests for paid homepage exposure. Additive and independent from
-- customer money. Rollback: remove the indexes, constraints and table only
-- after disabling the request routes; historical ad_billing rows are retained.
CREATE TABLE IF NOT EXISTS "home_exposure_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "status" varchar(40) DEFAULT 'submitted' NOT NULL,
  "placement_id" varchar(80) NOT NULL,
  "target_type" varchar(40) DEFAULT 'store' NOT NULL,
  "target_id" varchar(160),
  "commercial_model" varchar(40) DEFAULT 'duration' NOT NULL,
  "requested_starts_at" timestamp with time zone,
  "requested_ends_at" timestamp with time zone,
  "visibility_schedule" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "creative" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "quoted_amount" numeric(14,2),
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "activation_policy" varchar(40) DEFAULT 'manual_admin' NOT NULL,
  "admin_note" text,
  "campaign_id" uuid REFERENCES "ad_campaigns"("id") ON DELETE set null,
  "billing_id" uuid REFERENCES "ad_billing"("id") ON DELETE set null,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "home_exposure_requests_campaign_unique" ON "home_exposure_requests" ("campaign_id");
CREATE INDEX IF NOT EXISTS "home_exposure_requests_store_status_idx" ON "home_exposure_requests" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "home_exposure_requests_merchant_status_idx" ON "home_exposure_requests" ("merchant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "home_exposure_requests_status_created_idx" ON "home_exposure_requests" ("status", "created_at");
