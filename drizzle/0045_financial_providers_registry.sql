-- Central Financial Providers Registry and merchant provider accounts.
CREATE TABLE IF NOT EXISTS "financial_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(180) NOT NULL,
  "slug" varchar(180) NOT NULL,
  "type" varchar(40) NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "logo_url" text,
  "country_code" varchar(10),
  "currency_code" varchar(10) DEFAULT 'YER' NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "is_visible_to_merchants" boolean DEFAULT true NOT NULL,
  "supports_deposits" boolean DEFAULT true NOT NULL,
  "supports_withdrawals" boolean DEFAULT false NOT NULL,
  "supports_refunds" boolean DEFAULT false NOT NULL,
  "supports_cod" boolean DEFAULT false NOT NULL,
  "feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "financial_providers" ADD CONSTRAINT "financial_providers_type_check" CHECK ("type" IN ('bank','wallet','gateway','hawala','cod'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "financial_providers" ADD CONSTRAINT "financial_providers_status_check" CHECK ("status" IN ('active','disabled','restricted','blocked','maintenance'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "financial_providers_slug_unique" ON "financial_providers" ("slug");
CREATE INDEX IF NOT EXISTS "financial_providers_type_status_idx" ON "financial_providers" ("type", "status", "is_enabled");
CREATE INDEX IF NOT EXISTS "financial_providers_visible_idx" ON "financial_providers" ("is_visible_to_merchants", "sort_order");

CREATE TABLE IF NOT EXISTS "merchant_financial_provider_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "financial_provider_id" uuid NOT NULL,
  "account_number" varchar(180),
  "wallet_number" varchar(180),
  "beneficiary_name" varchar(180),
  "iban" varchar(80),
  "branch_name" varchar(180),
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "merchant_financial_provider_accounts" ADD CONSTRAINT "merchant_financial_provider_accounts_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "merchant_financial_provider_accounts" ADD CONSTRAINT "merchant_financial_provider_accounts_merchant_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "merchant_financial_provider_accounts" ADD CONSTRAINT "merchant_financial_provider_accounts_provider_fk" FOREIGN KEY ("financial_provider_id") REFERENCES "financial_providers"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "merchant_financial_provider_accounts_store_provider_idx" ON "merchant_financial_provider_accounts" ("store_id", "financial_provider_id", "status");
CREATE INDEX IF NOT EXISTS "merchant_financial_provider_accounts_merchant_idx" ON "merchant_financial_provider_accounts" ("merchant_id", "status");

ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "financial_provider_id" uuid;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "merchant_financial_account_id" uuid;
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_financial_provider_fk" FOREIGN KEY ("financial_provider_id") REFERENCES "financial_providers"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_merchant_financial_account_fk" FOREIGN KEY ("merchant_financial_account_id") REFERENCES "merchant_financial_provider_accounts"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "payment_methods_financial_provider_idx" ON "payment_methods" ("financial_provider_id", "is_active");

INSERT INTO "financial_providers" ("name", "slug", "type", "status", "currency_code", "is_enabled", "is_visible_to_merchants", "supports_deposits", "supports_withdrawals", "supports_refunds", "supports_cod", "feature_flags", "sort_order")
VALUES
  ('الدفع عند الاستلام', 'cash-on-delivery', 'cod', 'active', 'YER', true, true, true, false, false, true, '{"supportsMerchantPayouts":false,"supportsCustomerPayments":true,"supportsRefunds":false,"supportsSettlements":false}'::jsonb, 10),
  ('تحويل بنكي يدوي', 'manual-bank-transfer', 'bank', 'active', 'YER', true, true, true, true, false, false, '{"supportsMerchantPayouts":true,"supportsCustomerPayments":true,"supportsRefunds":false,"supportsSettlements":false}'::jsonb, 20),
  ('محفظة إلكترونية محلية', 'local-wallet', 'wallet', 'active', 'YER', true, true, true, true, false, false, '{"supportsMerchantPayouts":true,"supportsCustomerPayments":true,"supportsRefunds":false,"supportsSettlements":false}'::jsonb, 30),
  ('حوالة عبر شركة صرافة', 'hawala-remittance', 'hawala', 'active', 'YER', true, true, true, true, false, false, '{"supportsMerchantPayouts":true,"supportsCustomerPayments":true,"supportsRefunds":false,"supportsSettlements":false}'::jsonb, 40)
ON CONFLICT ("slug") DO NOTHING;
