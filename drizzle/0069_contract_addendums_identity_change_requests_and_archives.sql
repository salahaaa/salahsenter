-- Contract-governed store identity changes must be reviewed and, where relevant,
-- signed as an addendum instead of being directly merchant-editable.
CREATE TABLE IF NOT EXISTS "merchant_contract_addendums" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL REFERENCES "merchant_contracts"("id") ON DELETE cascade,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "amendment_number" varchar(100) NOT NULL,
  "version" varchar(80) NOT NULL,
  "title" varchar(180) NOT NULL,
  "reason" text,
  "changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "body_snapshot" text NOT NULL,
  "content_hash" varchar(128) NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "access_token_hash" text,
  "signer_name" varchar(180),
  "signature_url" text,
  "signed_snapshot" jsonb,
  "signed_at" timestamp with time zone,
  "approved_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "approved_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_contract_addendums_number_unique" ON "merchant_contract_addendums" ("contract_id", "amendment_number");
CREATE INDEX IF NOT EXISTS "merchant_contract_addendums_store_status_idx" ON "merchant_contract_addendums" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "merchant_contract_addendums_merchant_status_idx" ON "merchant_contract_addendums" ("merchant_id", "status");

CREATE TABLE IF NOT EXISTS "store_identity_change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "field_key" varchar(80) NOT NULL,
  "current_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requested_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(40) DEFAULT 'pending_review' NOT NULL,
  "addendum_id" uuid REFERENCES "merchant_contract_addendums"("id") ON DELETE set null,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "admin_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "store_identity_change_requests_store_status_idx" ON "store_identity_change_requests" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "store_identity_change_requests_merchant_status_idx" ON "store_identity_change_requests" ("merchant_id", "status");

CREATE TABLE IF NOT EXISTS "merchant_contract_archives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL REFERENCES "merchant_contracts"("id") ON DELETE cascade,
  "addendum_id" uuid REFERENCES "merchant_contract_addendums"("id") ON DELETE cascade,
  "kind" varchar(80) NOT NULL,
  "version" varchar(80) NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_contract_archives_addendum_kind_version_unique" ON "merchant_contract_archives" ("addendum_id", "kind", "version");
CREATE INDEX IF NOT EXISTS "merchant_contract_archives_contract_idx" ON "merchant_contract_archives" ("contract_id", "kind", "created_at");
CREATE INDEX IF NOT EXISTS "merchant_contract_archives_status_idx" ON "merchant_contract_archives" ("status", "updated_at");

INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('contracts.addendum.manage', 'إدارة ملاحق العقود', 'العقود', 'إنشاء واعتماد ملاحق العقود بعد التوقيع'),
  ('stores.identity_changes.review', 'مراجعة تغيير هوية المتجر', 'إدارة المتاجر', 'مراجعة طلبات اسم المتجر والبريد والبيانات المحمية'),
  ('store.identity_changes.view', 'عرض طلبات هوية المتجر', 'لوحة التاجر', 'عرض حالة طلبات تعديل البيانات التعاقدية'),
  ('store.identity_changes.create', 'طلب تعديل هوية المتجر', 'لوحة التاجر', 'إرسال طلب تعديل اسم المتجر أو البريد المحمي')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
