-- Hybrid rental billing: plan/subscription + per-store agreement + add-ons + recurring invoices.
CREATE TABLE IF NOT EXISTS "rental_addons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(120) NOT NULL,
  "name" varchar(180) NOT NULL,
  "description" text,
  "entitlement_key" varchar(120) NOT NULL,
  "price" numeric(14,2) DEFAULT '0' NOT NULL,
  "billing_cycle" varchar(40) DEFAULT 'monthly' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "rental_addons_code_unique" ON "rental_addons" ("code");
CREATE INDEX IF NOT EXISTS "rental_addons_active_idx" ON "rental_addons" ("is_active", "billing_cycle");

CREATE TABLE IF NOT EXISTS "store_rental_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "contract_id" uuid,
  "subscription_id" uuid,
  "base_rent" numeric(14,2) DEFAULT '0' NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "billing_cycle" varchar(40) DEFAULT 'monthly' NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "grace_days" integer DEFAULT 7 NOT NULL,
  "next_invoice_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "store_rental_agreements" ADD CONSTRAINT "store_rental_agreements_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_agreements" ADD CONSTRAINT "store_rental_agreements_merchant_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_agreements" ADD CONSTRAINT "store_rental_agreements_contract_fk" FOREIGN KEY ("contract_id") REFERENCES "merchant_contracts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_agreements" ADD CONSTRAINT "store_rental_agreements_subscription_fk" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_agreements" ADD CONSTRAINT "store_rental_agreements_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "store_rental_agreements_store_unique" ON "store_rental_agreements" ("store_id");
CREATE INDEX IF NOT EXISTS "store_rental_agreements_merchant_idx" ON "store_rental_agreements" ("merchant_id", "status");
CREATE INDEX IF NOT EXISTS "store_rental_agreements_due_idx" ON "store_rental_agreements" ("status", "next_invoice_at");

CREATE TABLE IF NOT EXISTS "store_rental_addon_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agreement_id" uuid NOT NULL,
  "addon_id" uuid NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price" numeric(14,2) DEFAULT '0' NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "store_rental_addon_assignments" ADD CONSTRAINT "store_rental_addon_assignments_agreement_fk" FOREIGN KEY ("agreement_id") REFERENCES "store_rental_agreements"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_addon_assignments" ADD CONSTRAINT "store_rental_addon_assignments_addon_fk" FOREIGN KEY ("addon_id") REFERENCES "rental_addons"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "store_rental_addon_assignments_agreement_idx" ON "store_rental_addon_assignments" ("agreement_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "store_rental_addon_assignments_unique_active" ON "store_rental_addon_assignments" ("agreement_id", "addon_id");

CREATE TABLE IF NOT EXISTS "store_rental_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agreement_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "invoice_number" varchar(100) NOT NULL,
  "invoice_type" varchar(40) DEFAULT 'recurring_rent' NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "base_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "addons_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(14,2) DEFAULT '0' NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "status" varchar(40) DEFAULT 'issued' NOT NULL,
  "due_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "payment_reference" varchar(180),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "store_rental_invoices" ADD CONSTRAINT "store_rental_invoices_agreement_fk" FOREIGN KEY ("agreement_id") REFERENCES "store_rental_agreements"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_invoices" ADD CONSTRAINT "store_rental_invoices_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_rental_invoices" ADD CONSTRAINT "store_rental_invoices_merchant_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "store_rental_invoices_number_unique" ON "store_rental_invoices" ("invoice_number");
CREATE INDEX IF NOT EXISTS "store_rental_invoices_agreement_idx" ON "store_rental_invoices" ("agreement_id", "status");
CREATE INDEX IF NOT EXISTS "store_rental_invoices_merchant_idx" ON "store_rental_invoices" ("merchant_id", "status");
CREATE INDEX IF NOT EXISTS "store_rental_invoices_due_idx" ON "store_rental_invoices" ("status", "due_at");
