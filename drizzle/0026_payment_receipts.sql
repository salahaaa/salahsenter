CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "order_payment_id" uuid,
  "user_id" uuid,
  "store_id" uuid,
  "provider" varchar(80) DEFAULT 'manual' NOT NULL,
  "transaction_reference" varchar(180),
  "sender_name" varchar(180),
  "sender_phone" varchar(60),
  "amount" numeric(12,2),
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "proof_url" text,
  "note" text,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_payment_id_order_payments_id_fk" FOREIGN KEY ("order_payment_id") REFERENCES "order_payments"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "payment_receipts_order_idx" ON "payment_receipts" ("order_id", "status");
CREATE INDEX IF NOT EXISTS "payment_receipts_payment_idx" ON "payment_receipts" ("order_payment_id");
CREATE INDEX IF NOT EXISTS "payment_receipts_store_idx" ON "payment_receipts" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "payment_receipts_user_idx" ON "payment_receipts" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "payment_receipts_reference_idx" ON "payment_receipts" ("provider", "transaction_reference");
