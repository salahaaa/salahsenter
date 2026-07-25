ALTER TYPE "public"."merchant_application_status" ADD VALUE 'waiting_final_approval' BEFORE 'approved';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"merchant_number" varchar(40) NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_title" varchar(180) DEFAULT 'عقد فتح متجر إلكتروني' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_version" varchar(40) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_body" text;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_signature_data_url" text;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "signed_contract_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "final_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "final_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "merchant_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "store_number" varchar(40);--> statement-breakpoint
UPDATE "stores" SET "store_number" = 'LEGACY-' || substring(replace("id"::text, '-', ''), 1, 12) WHERE "store_number" IS NULL;--> statement-breakpoint
ALTER TABLE "stores" ALTER COLUMN "store_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "merchants" ADD CONSTRAINT "merchants_application_id_merchant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."merchant_applications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merchants_user_unique" ON "merchants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merchants_number_unique" ON "merchants" USING btree ("merchant_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchants_application_idx" ON "merchants" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_final_approved_by_users_id_fk" FOREIGN KEY ("final_approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stores" ADD CONSTRAINT "stores_merchant_profile_id_merchants_id_fk" FOREIGN KEY ("merchant_profile_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stores_store_number_unique" ON "stores" USING btree ("store_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stores_merchant_profile_idx" ON "stores" USING btree ("merchant_profile_id");