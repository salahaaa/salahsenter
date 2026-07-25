CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "label" varchar(120) DEFAULT 'العنوان الرئيسي' NOT NULL,
  "recipient_name" varchar(160) NOT NULL,
  "phone" varchar(60) NOT NULL,
  "country_id" uuid,
  "governorate_id" uuid,
  "city_id" uuid,
  "district_id" uuid,
  "city_text" varchar(160),
  "district_text" varchar(160),
  "address_line" text NOT NULL,
  "landmark" text,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_governorate_id_governorates_id_fk" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "customer_addresses_user_idx" ON "customer_addresses" ("user_id", "is_default");
CREATE INDEX IF NOT EXISTS "customer_addresses_city_idx" ON "customer_addresses" ("city_id");

CREATE TABLE IF NOT EXISTS "wishlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "wishlists_user_product_unique" ON "wishlists" ("user_id", "product_id");
CREATE INDEX IF NOT EXISTS "wishlists_user_idx" ON "wishlists" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "wishlists_product_idx" ON "wishlists" ("product_id");

CREATE TABLE IF NOT EXISTS "coupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid,
  "code" varchar(80) NOT NULL,
  "title" varchar(180) NOT NULL,
  "description" text,
  "discount_type" varchar(40) DEFAULT 'percent' NOT NULL,
  "discount_value" numeric(12,2) DEFAULT '0' NOT NULL,
  "max_discount" numeric(12,2),
  "min_order_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "usage_limit" integer,
  "per_customer_limit" integer DEFAULT 1 NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_store_unique" ON "coupons" ("code", coalesce("store_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS "coupons_store_idx" ON "coupons" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "coupons_status_idx" ON "coupons" ("status", "starts_at", "ends_at");

CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "order_id" uuid,
  "user_id" uuid NOT NULL,
  "store_id" uuid,
  "code" varchar(80) NOT NULL,
  "discount_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_idx" ON "coupon_redemptions" ("coupon_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_idx" ON "coupon_redemptions" ("user_id", "code");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_order_idx" ON "coupon_redemptions" ("order_id");
