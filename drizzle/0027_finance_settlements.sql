CREATE TABLE IF NOT EXISTS "merchant_financial_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "available_balance" numeric(14,2) DEFAULT '0' NOT NULL,
  "pending_balance" numeric(14,2) DEFAULT '0' NOT NULL,
  "lifetime_earnings" numeric(14,2) DEFAULT '0' NOT NULL,
  "lifetime_payouts" numeric(14,2) DEFAULT '0' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "merchant_financial_accounts" ADD CONSTRAINT "merchant_financial_accounts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_financial_accounts" ADD CONSTRAINT "merchant_financial_accounts_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_financial_accounts_store_unique" ON "merchant_financial_accounts" ("store_id");
CREATE INDEX IF NOT EXISTS "merchant_financial_accounts_merchant_idx" ON "merchant_financial_accounts" ("merchant_id");

CREATE TABLE IF NOT EXISTS "merchant_payout_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "status" varchar(40) DEFAULT 'requested' NOT NULL,
  "method" varchar(80) DEFAULT 'bank_transfer' NOT NULL,
  "destination" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "note" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "merchant_payout_requests" ADD CONSTRAINT "merchant_payout_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_payout_requests" ADD CONSTRAINT "merchant_payout_requests_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_payout_requests" ADD CONSTRAINT "merchant_payout_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "merchant_payout_requests_store_idx" ON "merchant_payout_requests" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "merchant_payout_requests_merchant_idx" ON "merchant_payout_requests" ("merchant_id", "status");
CREATE INDEX IF NOT EXISTS "merchant_payout_requests_status_idx" ON "merchant_payout_requests" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "merchant_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "order_id" uuid,
  "order_payment_id" uuid,
  "payout_request_id" uuid,
  "type" varchar(80) NOT NULL,
  "direction" varchar(20) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "status" varchar(40) DEFAULT 'posted' NOT NULL,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "merchant_ledger_entries" ADD CONSTRAINT "merchant_ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "merchant_financial_accounts"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_ledger_entries" ADD CONSTRAINT "merchant_ledger_entries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_ledger_entries" ADD CONSTRAINT "merchant_ledger_entries_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_ledger_entries" ADD CONSTRAINT "merchant_ledger_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_ledger_entries" ADD CONSTRAINT "merchant_ledger_entries_payment_id_order_payments_id_fk" FOREIGN KEY ("order_payment_id") REFERENCES "order_payments"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "merchant_ledger_entries" ADD CONSTRAINT "merchant_ledger_entries_payout_id_payouts_id_fk" FOREIGN KEY ("payout_request_id") REFERENCES "merchant_payout_requests"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "merchant_ledger_entries_account_idx" ON "merchant_ledger_entries" ("account_id", "created_at");
CREATE INDEX IF NOT EXISTS "merchant_ledger_entries_store_idx" ON "merchant_ledger_entries" ("store_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_ledger_entries_order_type_unique" ON "merchant_ledger_entries" ("order_id", "type");
CREATE INDEX IF NOT EXISTS "merchant_ledger_entries_payout_idx" ON "merchant_ledger_entries" ("payout_request_id");
