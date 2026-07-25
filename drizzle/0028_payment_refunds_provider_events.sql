CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "order_payment_id" uuid,
  "return_request_id" uuid,
  "provider" varchar(80) DEFAULT 'manual' NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "currency" varchar(10) DEFAULT 'YER' NOT NULL,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "provider_reference" varchar(180),
  "provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reason" text,
  "requested_by" uuid,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_payment_id_order_payments_id_fk" FOREIGN KEY ("order_payment_id") REFERENCES "order_payments"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "payment_refunds_order_idx" ON "payment_refunds" ("order_id", "status");
CREATE INDEX IF NOT EXISTS "payment_refunds_payment_idx" ON "payment_refunds" ("order_payment_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_return_idx" ON "payment_refunds" ("return_request_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_provider_idx" ON "payment_refunds" ("provider", "provider_reference");

CREATE TABLE IF NOT EXISTS "payment_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(80) NOT NULL,
  "event_id" varchar(180) NOT NULL,
  "event_type" varchar(120) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_events_provider_event_unique" ON "payment_provider_events" ("provider", "event_id");
CREATE INDEX IF NOT EXISTS "payment_provider_events_type_idx" ON "payment_provider_events" ("provider", "event_type");
