CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"store_id" uuid,
	"provider" varchar(40) DEFAULT 'local' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(120),
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_method_id" uuid,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_reference" varchar(180),
	"provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"shipping_method_id" uuid,
	"status" varchar(80) DEFAULT 'pending' NOT NULL,
	"tracking_number" varchar(180),
	"carrier_name" varchar(160),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(140) NOT NULL,
	"code" varchar(120) NOT NULL,
	"description" text,
	"provider" varchar(80) DEFAULT 'manual' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(140) NOT NULL,
	"code" varchar(120) NOT NULL,
	"description" text,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"estimated_days_min" integer DEFAULT 1 NOT NULL,
	"estimated_days_max" integer DEFAULT 3 NOT NULL,
	"coverage_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_shipping_method_id_shipping_methods_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_owner_idx" ON "media_assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_store_idx" ON "media_assets" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_provider_idx" ON "media_assets" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_payments_order_idx" ON "order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_payments_method_idx" ON "order_payments" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_payments_status_idx" ON "order_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_shipments_order_idx" ON "order_shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_shipments_method_idx" ON "order_shipments" USING btree ("shipping_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_shipments_status_idx" ON "order_shipments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_code_unique" ON "payment_methods" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_active_idx" ON "payment_methods" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_methods_code_unique" ON "shipping_methods" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipping_methods_active_idx" ON "shipping_methods" USING btree ("is_active");