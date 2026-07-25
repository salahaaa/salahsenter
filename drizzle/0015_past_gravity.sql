CREATE TABLE "store_branch_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"parent_store_id" uuid,
	"branch_code" varchar(80) NOT NULL,
	"branch_name" varchar(180) NOT NULL,
	"branch_type" varchar(40) DEFAULT 'branch' NOT NULL,
	"country_id" uuid,
	"governorate_id" uuid,
	"city_id" uuid,
	"district_id" uuid,
	"address" text,
	"rent_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"rent_currency" varchar(10) DEFAULT 'YER' NOT NULL,
	"rent_cycle" varchar(40) DEFAULT 'monthly' NOT NULL,
	"rent_status" varchar(40) DEFAULT 'pending' NOT NULL,
	"rent_starts_at" timestamp with time zone,
	"next_rent_due_at" timestamp with time zone,
	"approval_status" varchar(40) DEFAULT 'pending_approval' NOT NULL,
	"admin_note" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"merchant_profile_id" uuid,
	"main_store_id" uuid,
	"company_name" varchar(180) NOT NULL,
	"commercial_name" varchar(180),
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_rent_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"invoice_number" varchar(80) NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'YER' NOT NULL,
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"payment_reference" varchar(180),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_group_id_store_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."store_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_parent_store_id_stores_id_fk" FOREIGN KEY ("parent_store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_governorate_id_governorates_id_fk" FOREIGN KEY ("governorate_id") REFERENCES "public"."governorates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_branch_profiles" ADD CONSTRAINT "store_branch_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_groups" ADD CONSTRAINT "store_groups_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_groups" ADD CONSTRAINT "store_groups_merchant_profile_id_merchants_id_fk" FOREIGN KEY ("merchant_profile_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_groups" ADD CONSTRAINT "store_groups_main_store_id_stores_id_fk" FOREIGN KEY ("main_store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_rent_invoices" ADD CONSTRAINT "store_rent_invoices_branch_id_store_branch_profiles_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."store_branch_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_rent_invoices" ADD CONSTRAINT "store_rent_invoices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_rent_invoices" ADD CONSTRAINT "store_rent_invoices_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_branch_profiles_store_unique" ON "store_branch_profiles" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "store_branch_profiles_group_idx" ON "store_branch_profiles" USING btree ("group_id","approval_status");--> statement-breakpoint
CREATE UNIQUE INDEX "store_branch_profiles_group_code_unique" ON "store_branch_profiles" USING btree ("group_id","branch_code");--> statement-breakpoint
CREATE INDEX "store_branch_profiles_rent_idx" ON "store_branch_profiles" USING btree ("rent_status","next_rent_due_at");--> statement-breakpoint
CREATE INDEX "store_groups_merchant_idx" ON "store_groups" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "store_groups_main_store_idx" ON "store_groups" USING btree ("main_store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_rent_invoices_number_unique" ON "store_rent_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "store_rent_invoices_branch_idx" ON "store_rent_invoices" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "store_rent_invoices_merchant_idx" ON "store_rent_invoices" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "store_rent_invoices_due_idx" ON "store_rent_invoices" USING btree ("status","due_at");