-- Platform-only revenue model: rent / commission / promotion agreements remain
-- independent from customer order money and merchant payout flows.
ALTER TABLE "store_rental_agreements" ADD COLUMN IF NOT EXISTS "consolidated_billing" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "merchant_revenue_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "contract_id" uuid REFERENCES "merchant_contracts"("id") ON DELETE set null,
  "model" varchar(40) DEFAULT 'monthly_rent' NOT NULL,
  "monthly_rent" numeric(14,2) DEFAULT '0' NOT NULL,
  "commission_rate" numeric(6,3) DEFAULT '0' NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "due_days" integer DEFAULT 7 NOT NULL,
  "grace_days" integer DEFAULT 7 NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_revenue_terms_store_unique" ON "merchant_revenue_terms" ("store_id");
CREATE INDEX IF NOT EXISTS "merchant_revenue_terms_merchant_status_idx" ON "merchant_revenue_terms" ("merchant_id", "status");
CREATE INDEX IF NOT EXISTS "merchant_revenue_terms_active_period_idx" ON "merchant_revenue_terms" ("status", "starts_at", "ends_at");

CREATE TABLE IF NOT EXISTS "merchant_promotion_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "contract_id" uuid REFERENCES "merchant_contracts"("id") ON DELETE set null,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "homepage_banner_fee" numeric(14,2) DEFAULT '0' NOT NULL,
  "featured_product_fee" numeric(14,2) DEFAULT '0' NOT NULL,
  "featured_store_fee" numeric(14,2) DEFAULT '0' NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_promotion_agreements_store_unique" ON "merchant_promotion_agreements" ("store_id");
CREATE INDEX IF NOT EXISTS "merchant_promotion_agreements_merchant_status_idx" ON "merchant_promotion_agreements" ("merchant_id", "status");
CREATE INDEX IF NOT EXISTS "merchant_promotion_agreements_active_period_idx" ON "merchant_promotion_agreements" ("status", "starts_at", "ends_at");

CREATE TABLE IF NOT EXISTS "merchant_sales_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "sales_total" numeric(14,2) DEFAULT '0' NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "source" varchar(40) DEFAULT 'merchant_manual' NOT NULL,
  "external_reference" varchar(180),
  "status" varchar(40) DEFAULT 'submitted' NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_sales_reports_store_period_unique" ON "merchant_sales_reports" ("store_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "merchant_sales_reports_merchant_status_idx" ON "merchant_sales_reports" ("merchant_id", "status", "period_end");
CREATE INDEX IF NOT EXISTS "merchant_sales_reports_review_idx" ON "merchant_sales_reports" ("status", "submitted_at");

CREATE TABLE IF NOT EXISTS "merchant_platform_statements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "revenue_terms_id" uuid REFERENCES "merchant_revenue_terms"("id") ON DELETE set null,
  "statement_number" varchar(100) NOT NULL,
  "source_key" varchar(180) NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "rent_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "commission_base" numeric(14,2) DEFAULT '0' NOT NULL,
  "commission_rate" numeric(6,3) DEFAULT '0' NOT NULL,
  "commission_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "advertising_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "addons_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "adjustment_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "due_at" timestamp with time zone,
  "grace_ends_at" timestamp with time zone,
  "issued_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "settled_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_platform_statements_source_unique" ON "merchant_platform_statements" ("source_key");
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_platform_statements_number_unique" ON "merchant_platform_statements" ("statement_number");
CREATE INDEX IF NOT EXISTS "merchant_platform_statements_store_status_idx" ON "merchant_platform_statements" ("store_id", "status", "due_at");
CREATE INDEX IF NOT EXISTS "merchant_platform_statements_merchant_period_idx" ON "merchant_platform_statements" ("merchant_id", "period_start");

CREATE TABLE IF NOT EXISTS "merchant_platform_statement_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "statement_id" uuid NOT NULL REFERENCES "merchant_platform_statements"("id") ON DELETE cascade,
  "line_type" varchar(40) NOT NULL,
  "source_type" varchar(80),
  "source_id" varchar(180),
  "description" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_platform_statement_lines_source_unique" ON "merchant_platform_statement_lines" ("statement_id", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "merchant_platform_statement_lines_statement_idx" ON "merchant_platform_statement_lines" ("statement_id", "line_type");

INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('platform_revenue.terms.manage', 'إدارة شروط إيراد المنصة', 'إيرادات المنصة', 'تحديد نموذج الإيجار والعمولة لكل متجر'),
  ('platform_revenue.promotions.manage', 'إدارة اتفاقات الترويج', 'إيرادات المنصة', 'تحديد رسوم الواجهة الرئيسية والظهور المميز'),
  ('platform_revenue.sales_reports.review', 'مراجعة تقارير المبيعات', 'إيرادات المنصة', 'اعتماد أو رفض تقرير مبيعات التاجر'),
  ('platform_revenue.statements.view', 'عرض كشوف إيراد المنصة', 'إيرادات المنصة', 'عرض الفواتير الموحدة للتجار'),
  ('platform_revenue.statements.issue', 'إصدار كشوف إيراد المنصة', 'إيرادات المنصة', 'إصدار كشف شهري موحد'),
  ('platform_revenue.statements.settle', 'تسوية كشوف إيراد المنصة', 'إيرادات المنصة', 'تأكيد أو رفض سداد كشف موحد'),
  ('store.platform_revenue.view', 'عرض كشف المنصة للمتجر', 'إيرادات المنصة', 'عرض فواتير المنصة الموحدة'),
  ('store.platform_revenue.sales_report.submit', 'إرسال تقرير مبيعات', 'إيرادات المنصة', 'إرسال تقرير المبيعات الشهري للعمولة')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
