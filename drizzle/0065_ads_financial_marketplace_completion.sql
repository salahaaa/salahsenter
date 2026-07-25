-- Ads platform completion: explicit placement/billing semantics, operational budget reserves,
-- auditable invoices, fraud signals and richer materialized reporting. All changes are additive.
ALTER TABLE "ad_campaigns" ADD COLUMN IF NOT EXISTS "placement_id" varchar(80);
ALTER TABLE "ad_campaigns" ADD COLUMN IF NOT EXISTS "billing_model" varchar(20) DEFAULT 'cpc' NOT NULL;
ALTER TABLE "ad_campaigns" ADD COLUMN IF NOT EXISTS "billing_state" varchar(40) DEFAULT 'operational_reserve' NOT NULL;
ALTER TABLE "ad_campaigns" ADD COLUMN IF NOT EXISTS "frequency_cap" integer DEFAULT 3 NOT NULL;
UPDATE "ad_campaigns"
SET "placement_id" = CASE "type"
  WHEN 'homepage_banner' THEN 'homepage_marketplace_ads'
  WHEN 'category_banner' THEN 'category_listing'
  WHEN 'featured_products' THEN 'homepage_featured_products'
  ELSE 'homepage_sponsored_products'
END
WHERE "placement_id" IS NULL OR btrim("placement_id") = '';
ALTER TABLE "ad_campaigns" ALTER COLUMN "placement_id" SET DEFAULT 'homepage_sponsored_products';
ALTER TABLE "ad_campaigns" ALTER COLUMN "placement_id" SET NOT NULL;

ALTER TABLE "ad_impressions" ADD COLUMN IF NOT EXISTS "cost" numeric(14,2) DEFAULT '0' NOT NULL;
ALTER TABLE "ad_clicks" ADD COLUMN IF NOT EXISTS "fraud_status" varchar(20) DEFAULT 'pending' NOT NULL;
CREATE INDEX IF NOT EXISTS "ad_clicks_campaign_ip_created_idx" ON "ad_clicks" ("campaign_id", "ip_address", "created_at");
CREATE INDEX IF NOT EXISTS "ad_clicks_campaign_fraud_created_idx" ON "ad_clicks" ("campaign_id", "fraud_status", "created_at");

CREATE TABLE IF NOT EXISTS "ad_budget_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "ad_campaigns"("id") ON DELETE cascade,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "reservation_key" varchar(180) NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "reserved_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "consumed_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "released_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ad_budget_reservations_campaign_unique" ON "ad_budget_reservations" ("campaign_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ad_budget_reservations_key_unique" ON "ad_budget_reservations" ("reservation_key");
CREATE INDEX IF NOT EXISTS "ad_budget_reservations_store_status_idx" ON "ad_budget_reservations" ("store_id", "status");

CREATE TABLE IF NOT EXISTS "ad_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "source_key" varchar(180) NOT NULL,
  "invoice_number" varchar(100) NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "total_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "status" varchar(40) DEFAULT 'issued' NOT NULL,
  "due_at" timestamp with time zone,
  "issued_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "settled_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ad_invoices_source_unique" ON "ad_invoices" ("source_key");
CREATE UNIQUE INDEX IF NOT EXISTS "ad_invoices_number_unique" ON "ad_invoices" ("invoice_number");
CREATE INDEX IF NOT EXISTS "ad_invoices_merchant_status_idx" ON "ad_invoices" ("merchant_id", "status", "due_at");
CREATE INDEX IF NOT EXISTS "ad_invoices_store_period_idx" ON "ad_invoices" ("store_id", "period_start");

ALTER TABLE "ad_billing" ADD COLUMN IF NOT EXISTS "invoice_id" uuid REFERENCES "ad_invoices"("id") ON DELETE set null;
CREATE INDEX IF NOT EXISTS "ad_billing_invoice_idx" ON "ad_billing" ("invoice_id");

CREATE TABLE IF NOT EXISTS "ad_invoice_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "ad_invoices"("id") ON DELETE cascade,
  "billing_id" uuid NOT NULL REFERENCES "ad_billing"("id") ON DELETE restrict,
  "campaign_id" uuid NOT NULL REFERENCES "ad_campaigns"("id") ON DELETE cascade,
  "description" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_amount" numeric(14,2) NOT NULL,
  "total_amount" numeric(14,2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ad_invoice_lines_billing_unique" ON "ad_invoice_lines" ("billing_id");
CREATE INDEX IF NOT EXISTS "ad_invoice_lines_invoice_idx" ON "ad_invoice_lines" ("invoice_id", "campaign_id");

CREATE TABLE IF NOT EXISTS "ad_fraud_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "ad_campaigns"("id") ON DELETE cascade,
  "click_id" uuid REFERENCES "ad_clicks"("id") ON DELETE set null,
  "event_key" varchar(180) NOT NULL,
  "signal_type" varchar(80) NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "status" varchar(30) DEFAULT 'observed' NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ad_fraud_signals_event_signal_unique" ON "ad_fraud_signals" ("event_key", "signal_type");
CREATE INDEX IF NOT EXISTS "ad_fraud_signals_campaign_status_idx" ON "ad_fraud_signals" ("campaign_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "ad_fraud_signals_click_idx" ON "ad_fraud_signals" ("click_id");

ALTER TABLE "ad_reports" ADD COLUMN IF NOT EXISTS "cvr" numeric(8,4) DEFAULT '0' NOT NULL;
ALTER TABLE "ad_reports" ADD COLUMN IF NOT EXISTS "invalid_clicks" integer DEFAULT 0 NOT NULL;

INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('ads.billing.view', 'عرض فوترة الإعلانات', 'إدارة الإعلانات', 'عرض دفتر التكاليف وفواتير الإعلانات'),
  ('ads.billing.issue', 'إصدار فواتير الإعلانات', 'إدارة الإعلانات', 'تشغيل أو إصدار فواتير رسوم الحملات'),
  ('ads.billing.settle', 'تسوية فواتير الإعلانات', 'إدارة الإعلانات', 'تأكيد أو إلغاء تسوية فاتورة إعلانات'),
  ('ads.fraud.view', 'عرض إشارات نقرات مشبوهة', 'إدارة الإعلانات', 'عرض الإشارات والتحقيق في جودة زيارات الإعلانات'),
  ('store.ads.billing.view', 'عرض فواتير إعلان المتجر', 'إدارة الإعلانات', 'عرض دفتر وفواتير حملات المتجر')
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
