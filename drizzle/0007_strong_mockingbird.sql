ALTER TYPE "public"."merchant_application_status" ADD VALUE 'pending' BEFORE 'under_review';--> statement-breakpoint
ALTER TYPE "public"."merchant_application_status" ADD VALUE 'documents_required' BEFORE 'waiting_final_approval';--> statement-breakpoint
ALTER TYPE "public"."merchant_application_status" ADD VALUE 'pre_approved' BEFORE 'waiting_final_approval';--> statement-breakpoint
ALTER TYPE "public"."merchant_application_status" ADD VALUE 'contract_created' BEFORE 'waiting_final_approval';--> statement-breakpoint
ALTER TYPE "public"."merchant_application_status" ADD VALUE 'contract_signed' BEFORE 'waiting_final_approval';--> statement-breakpoint
ALTER TYPE "public"."merchant_application_status" ADD VALUE 'active' BEFORE 'rejected';--> statement-breakpoint
CREATE TABLE "merchant_application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"document_type" varchar(80) NOT NULL,
	"title" varchar(180),
	"file_url" text NOT NULL,
	"file_name" varchar(255),
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"note" text,
	"uploaded_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "onboarding_contract_number" varchar(60);--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "contract_duration_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "commission_rate" numeric(6, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_applications" ADD COLUMN "subscription_fee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_application_documents" ADD CONSTRAINT "merchant_application_documents_application_id_merchant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."merchant_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_application_documents" ADD CONSTRAINT "merchant_application_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_application_documents" ADD CONSTRAINT "merchant_application_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_application_documents_application_idx" ON "merchant_application_documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "merchant_application_documents_type_idx" ON "merchant_application_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "merchant_application_documents_status_idx" ON "merchant_application_documents" USING btree ("status");