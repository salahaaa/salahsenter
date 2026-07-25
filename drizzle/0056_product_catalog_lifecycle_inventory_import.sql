-- Product OS: lifecycle/review/scheduling, variant change history, stock counts and import rollback.
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'paused';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publish_at" timestamp with time zone;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unpublish_at" timestamp with time zone;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "review_note" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_reviewed_by_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "products_lifecycle_idx" ON "products" ("status", "publish_at", "unpublish_at");

CREATE TABLE IF NOT EXISTS "product_lifecycle_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "from_status" varchar(40),
  "to_status" varchar(40) NOT NULL,
  "reason" text,
  "actor_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "product_lifecycle_events" ADD CONSTRAINT "product_lifecycle_events_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_lifecycle_events" ADD CONSTRAINT "product_lifecycle_events_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_lifecycle_events" ADD CONSTRAINT "product_lifecycle_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "product_lifecycle_events_product_idx" ON "product_lifecycle_events" ("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "product_lifecycle_events_store_idx" ON "product_lifecycle_events" ("store_id", "created_at");

CREATE TABLE IF NOT EXISTS "variant_change_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "variant_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "change_type" varchar(60) NOT NULL,
  "before_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "after_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reason" text,
  "actor_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "variant_change_logs" ADD CONSTRAINT "variant_change_logs_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "variant_change_logs" ADD CONSTRAINT "variant_change_logs_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "variant_change_logs" ADD CONSTRAINT "variant_change_logs_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "variant_change_logs" ADD CONSTRAINT "variant_change_logs_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "variant_change_logs_variant_idx" ON "variant_change_logs" ("variant_id", "created_at");
CREATE INDEX IF NOT EXISTS "variant_change_logs_product_idx" ON "variant_change_logs" ("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "variant_change_logs_store_idx" ON "variant_change_logs" ("store_id", "created_at");

CREATE TABLE IF NOT EXISTS "inventory_stock_counts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "title" varchar(180) DEFAULT 'جرد دوري' NOT NULL,
  "note" text,
  "created_by" uuid,
  "applied_by" uuid,
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "inventory_stock_counts" ADD CONSTRAINT "inventory_stock_counts_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_stock_counts" ADD CONSTRAINT "inventory_stock_counts_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_stock_counts" ADD CONSTRAINT "inventory_stock_counts_applied_by_fk" FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "inventory_stock_counts_store_idx" ON "inventory_stock_counts" ("store_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "inventory_stock_count_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stock_count_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "expected_quantity" integer NOT NULL,
  "counted_quantity" integer,
  "difference_quantity" integer,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "inventory_stock_count_lines" ADD CONSTRAINT "inventory_stock_count_lines_count_fk" FOREIGN KEY ("stock_count_id") REFERENCES "inventory_stock_counts"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_stock_count_lines" ADD CONSTRAINT "inventory_stock_count_lines_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inventory_stock_count_lines" ADD CONSTRAINT "inventory_stock_count_lines_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stock_count_lines_count_variant_unique" ON "inventory_stock_count_lines" ("stock_count_id", "variant_id");
CREATE INDEX IF NOT EXISTS "inventory_stock_count_lines_count_idx" ON "inventory_stock_count_lines" ("stock_count_id");

CREATE TABLE IF NOT EXISTS "product_import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "source_file_name" varchar(255),
  "mode" varchar(40) DEFAULT 'create' NOT NULL,
  "status" varchar(40) DEFAULT 'completed' NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "success_rows" integer DEFAULT 0 NOT NULL,
  "failed_rows" integer DEFAULT 0 NOT NULL,
  "imported_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "results" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" uuid,
  "rolled_back_at" timestamp with time zone,
  "rolled_back_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "product_import_runs" ADD CONSTRAINT "product_import_runs_store_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_import_runs" ADD CONSTRAINT "product_import_runs_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "product_import_runs" ADD CONSTRAINT "product_import_runs_rolled_back_by_fk" FOREIGN KEY ("rolled_back_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "product_import_runs_store_idx" ON "product_import_runs" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "product_import_runs_status_idx" ON "product_import_runs" ("status", "rolled_back_at");
