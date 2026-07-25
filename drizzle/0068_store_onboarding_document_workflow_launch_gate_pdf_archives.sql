-- Close merchant onboarding gaps: explicit document approval, immutable PDF archives,
-- revenue terms at onboarding and public launch readiness gate.
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "revenue_model" varchar(40) DEFAULT 'monthly_rent' NOT NULL;
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "monthly_rent" numeric(12,2) DEFAULT '0' NOT NULL;
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "due_days" integer DEFAULT 7 NOT NULL;
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "grace_days" integer DEFAULT 7 NOT NULL;

ALTER TABLE "merchant_application_documents" ADD COLUMN IF NOT EXISTS "requirement_id" uuid;
ALTER TABLE "merchant_application_documents" ADD COLUMN IF NOT EXISTS "media_asset_id" uuid;
ALTER TABLE "merchant_application_documents" ADD COLUMN IF NOT EXISTS "storage_key" text;
ALTER TABLE "merchant_application_documents" ADD COLUMN IF NOT EXISTS "mime_type" varchar(120);
ALTER TABLE "merchant_application_documents" ADD COLUMN IF NOT EXISTS "sha256" varchar(128);
CREATE INDEX IF NOT EXISTS "merchant_application_documents_requirement_idx" ON "merchant_application_documents" ("requirement_id");

CREATE TABLE IF NOT EXISTS "merchant_application_document_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "merchant_applications"("id") ON DELETE cascade,
  "document_type" varchar(80) NOT NULL,
  "title" varchar(180) NOT NULL,
  "is_required" boolean DEFAULT true NOT NULL,
  "status" varchar(40) DEFAULT 'requested' NOT NULL,
  "document_id" uuid REFERENCES "merchant_application_documents"("id") ON DELETE set null,
  "requested_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "merchant_application_document_requirements_application_idx" ON "merchant_application_document_requirements" ("application_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_application_document_requirements_type_unique" ON "merchant_application_document_requirements" ("application_id", "document_type");
ALTER TABLE "merchant_application_documents" ADD CONSTRAINT "merchant_application_documents_requirement_fk" FOREIGN KEY ("requirement_id") REFERENCES "merchant_application_document_requirements"("id") ON DELETE set null;
ALTER TABLE "merchant_application_documents" ADD CONSTRAINT "merchant_application_documents_media_asset_fk" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "store_launch_readiness" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "application_id" uuid REFERENCES "merchant_applications"("id") ON DELETE set null,
  "status" varchar(40) DEFAULT 'setup_pending' NOT NULL,
  "checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "submitted_at" timestamp with time zone,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "store_launch_readiness_store_unique" ON "store_launch_readiness" ("store_id");
CREATE INDEX IF NOT EXISTS "store_launch_readiness_status_idx" ON "store_launch_readiness" ("status", "submitted_at");

CREATE TABLE IF NOT EXISTS "merchant_application_archives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "merchant_applications"("id") ON DELETE cascade,
  "kind" varchar(80) NOT NULL,
  "version" varchar(80) DEFAULT '1.0' NOT NULL,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "media_asset_id" uuid REFERENCES "media_assets"("id") ON DELETE set null,
  "url" text,
  "storage_key" text,
  "sha256" varchar(128),
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "generated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "generated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_application_archives_kind_version_unique" ON "merchant_application_archives" ("application_id", "kind", "version");
CREATE INDEX IF NOT EXISTS "merchant_application_archives_status_idx" ON "merchant_application_archives" ("status", "updated_at");

INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('merchant_applications.documents.review', 'مراجعة وثائق فتح المتجر', 'طلبات التجار', 'اعتماد أو رفض أو إعفاء وثائق طلب فتح متجر'),
  ('merchant_applications.launch.review', 'مراجعة جاهزية إطلاق المتجر', 'طلبات التجار', 'اعتماد أو رفض نشر المتجر بعد التهيئة'),
  ('store.onboarding.view', 'عرض جاهزية إطلاق المتجر', 'لوحة التاجر', 'عرض checklist التهيئة قبل الإطلاق العام'),
  ('store.onboarding.submit', 'إرسال جاهزية إطلاق المتجر', 'لوحة التاجر', 'إرسال checklist المتجر للإدارة للمراجعة')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
