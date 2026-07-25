-- Product OS completion: suppliers/costing, inter-branch transfers, sector-gated batches/expiry and review moderation.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "average_cost" numeric(12,2) DEFAULT '0' NOT NULL;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "last_cost" numeric(12,2) DEFAULT '0' NOT NULL;

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL, "code" varchar(80), "name" varchar(180) NOT NULL,
  "contact_name" varchar(160), "phone" varchar(60), "email" varchar(255), "address" text, "notes" text,
  "status" varchar(30) DEFAULT 'active' NOT NULL, "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "suppliers_store_idx" ON "suppliers" ("store_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_store_code_unique" ON "suppliers" ("store_id", "code");

CREATE TABLE IF NOT EXISTS "product_suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid, "supplier_id" uuid NOT NULL,
  "supplier_sku" varchar(160), "purchase_cost" numeric(12,2) DEFAULT '0' NOT NULL, "lead_time_days" integer, "is_preferred" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "product_suppliers_product_idx" ON "product_suppliers" ("product_id", "variant_id");
CREATE INDEX IF NOT EXISTS "product_suppliers_supplier_idx" ON "product_suppliers" ("supplier_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_suppliers_unique_variant" ON "product_suppliers" ("supplier_id", "product_id", "variant_id") WHERE "variant_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "product_suppliers_unique_product" ON "product_suppliers" ("supplier_id", "product_id") WHERE "variant_id" IS NULL;

CREATE TABLE IF NOT EXISTS "inventory_cost_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "supplier_id" uuid,
  "quantity" integer NOT NULL, "unit_cost" numeric(12,2) NOT NULL, "previous_quantity" integer NOT NULL,
  "previous_average_cost" numeric(12,2) DEFAULT '0' NOT NULL, "resulting_average_cost" numeric(12,2) DEFAULT '0' NOT NULL,
  "reference_number" varchar(140), "note" text, "received_by" uuid,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "inventory_cost_receipts" ADD CONSTRAINT "inventory_cost_receipts_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_cost_receipts" ADD CONSTRAINT "inventory_cost_receipts_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_cost_receipts" ADD CONSTRAINT "inventory_cost_receipts_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_cost_receipts" ADD CONSTRAINT "inventory_cost_receipts_supplier_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_cost_receipts" ADD CONSTRAINT "inventory_cost_receipts_received_by_fk" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "inventory_cost_receipts_store_idx" ON "inventory_cost_receipts" ("store_id", "received_at");
CREATE INDEX IF NOT EXISTS "inventory_cost_receipts_variant_idx" ON "inventory_cost_receipts" ("variant_id", "received_at");

CREATE TABLE IF NOT EXISTS "inventory_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_store_id" uuid NOT NULL, "destination_store_id" uuid NOT NULL, "status" varchar(30) DEFAULT 'draft' NOT NULL,
  "reference_number" varchar(120) NOT NULL, "note" text, "requested_by" uuid, "received_by" uuid,
  "sent_at" timestamp with time zone, "received_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_fk" FOREIGN KEY ("source_store_id") REFERENCES "stores"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_fk" FOREIGN KEY ("destination_store_id") REFERENCES "stores"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_requested_by_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_received_by_fk" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "inventory_transfers_source_idx" ON "inventory_transfers" ("source_store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_transfers_destination_idx" ON "inventory_transfers" ("destination_store_id", "status", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transfers_reference_unique" ON "inventory_transfers" ("reference_number");

CREATE TABLE IF NOT EXISTS "inventory_transfer_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "transfer_id" uuid NOT NULL,
  "source_product_id" uuid NOT NULL, "source_variant_id" uuid NOT NULL,
  "destination_product_id" uuid, "destination_variant_id" uuid,
  "quantity" integer NOT NULL, "received_quantity" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_transfer_fk" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_source_product_fk" FOREIGN KEY ("source_product_id") REFERENCES "products"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_source_variant_fk" FOREIGN KEY ("source_variant_id") REFERENCES "product_variants"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_destination_product_fk" FOREIGN KEY ("destination_product_id") REFERENCES "products"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_destination_variant_fk" FOREIGN KEY ("destination_variant_id") REFERENCES "product_variants"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "inventory_transfer_lines_transfer_idx" ON "inventory_transfer_lines" ("transfer_id");

CREATE TABLE IF NOT EXISTS "inventory_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "supplier_id" uuid,
  "batch_number" varchar(140) NOT NULL, "expiry_date" timestamp with time zone,
  "received_quantity" integer NOT NULL, "available_quantity" integer NOT NULL, "unit_cost" numeric(12,2) DEFAULT '0' NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL, "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_supplier_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "inventory_batches_store_expiry_idx" ON "inventory_batches" ("store_id", "expiry_date", "status");
CREATE INDEX IF NOT EXISTS "inventory_batches_variant_idx" ON "inventory_batches" ("variant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_batches_store_variant_batch_unique" ON "inventory_batches" ("store_id", "variant_id", "batch_number");

CREATE TABLE IF NOT EXISTS "store_capabilities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "store_id" uuid NOT NULL, "code" varchar(100) NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL, "configured_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "store_capabilities" ADD CONSTRAINT "store_capabilities_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "store_capabilities" ADD CONSTRAINT "store_capabilities_configured_by_fk" FOREIGN KEY ("configured_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "store_capabilities_store_code_unique" ON "store_capabilities" ("store_id", "code");
CREATE INDEX IF NOT EXISTS "store_capabilities_store_idx" ON "store_capabilities" ("store_id", "is_enabled");

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderation_status" varchar(30) DEFAULT 'approved' NOT NULL;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderated_by" uuid;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderated_at" timestamp with time zone;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderation_note" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_fk" FOREIGN KEY ("moderated_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "reviews_moderation_idx" ON "reviews" ("store_id", "moderation_status", "created_at");

CREATE TABLE IF NOT EXISTS "review_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "review_id" uuid NOT NULL, "url" text NOT NULL,
  "mime_type" varchar(120), "sort_order" integer DEFAULT 0 NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "review_media_review_idx" ON "review_media" ("review_id", "sort_order");

CREATE TABLE IF NOT EXISTS "review_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "review_id" uuid NOT NULL, "reporter_id" uuid,
  "reason" varchar(120) NOT NULL, "detail" text, "status" varchar(30) DEFAULT 'open' NOT NULL,
  "resolved_by" uuid, "resolved_at" timestamp with time zone, "resolution_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_fk" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolved_by_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "review_reports_review_idx" ON "review_reports" ("review_id", "status");
CREATE INDEX IF NOT EXISTS "review_reports_reporter_idx" ON "review_reports" ("reporter_id");

CREATE TABLE IF NOT EXISTS "review_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "review_id" uuid NOT NULL, "store_id" uuid NOT NULL, "user_id" uuid,
  "body" text NOT NULL, "is_visible" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "review_replies_review_unique" ON "review_replies" ("review_id");
CREATE INDEX IF NOT EXISTS "review_replies_store_idx" ON "review_replies" ("store_id");
