-- Generic ERP onboarding: provider-neutral connector catalog and merchant request lifecycle.
CREATE TABLE IF NOT EXISTS "erp_connector_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(120) NOT NULL,
  "provider" varchar(160) NOT NULL,
  "display_name" varchar(180) NOT NULL,
  "version" varchar(80) DEFAULT '1.0' NOT NULL,
  "system_type" varchar(80) DEFAULT 'generic' NOT NULL,
  "connection_modes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "support_owner" varchar(180),
  "documentation_url" text,
  "agent_package_url" text,
  "package_checksum" varchar(180),
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "erp_connector_catalog_code_version_unique" ON "erp_connector_catalog" ("code", "version");
CREATE INDEX IF NOT EXISTS "erp_connector_catalog_provider_status_idx" ON "erp_connector_catalog" ("provider", "status");
CREATE INDEX IF NOT EXISTS "erp_connector_catalog_system_status_idx" ON "erp_connector_catalog" ("system_type", "status");

CREATE TABLE IF NOT EXISTS "erp_integration_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_number" varchar(80) NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "provider" varchar(160) NOT NULL,
  "erp_version" varchar(100),
  "erp_type" varchar(80) DEFAULT 'desktop' NOT NULL,
  "connection_method" varchar(80) DEFAULT 'local_agent' NOT NULL,
  "branch_count" integer DEFAULT 0 NOT NULL,
  "warehouse_count" integer DEFAULT 0 NOT NULL,
  "business_activity" varchar(180),
  "operations_volume" varchar(80),
  "technical_contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "readiness" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "mapping_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(50) DEFAULT 'pending_review' NOT NULL,
  "connector_catalog_id" uuid REFERENCES "erp_connector_catalog"("id") ON DELETE set null,
  "integration_client_id" uuid REFERENCES "integration_clients"("id") ON DELETE set null,
  "certification_id" uuid REFERENCES "erp_connector_certifications"("id") ON DELETE set null,
  "assigned_to" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "activated_at" timestamp with time zone,
  "activated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "merchant_note" text,
  "admin_note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "erp_integration_requests_number_unique" ON "erp_integration_requests" ("request_number");
CREATE INDEX IF NOT EXISTS "erp_integration_requests_store_status_idx" ON "erp_integration_requests" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "erp_integration_requests_merchant_status_idx" ON "erp_integration_requests" ("merchant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "erp_integration_requests_connector_idx" ON "erp_integration_requests" ("connector_catalog_id", "status");
CREATE INDEX IF NOT EXISTS "erp_integration_requests_client_idx" ON "erp_integration_requests" ("integration_client_id");

CREATE TABLE IF NOT EXISTS "erp_integration_request_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL REFERENCES "erp_integration_requests"("id") ON DELETE cascade,
  "actor_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "action" varchar(100) NOT NULL,
  "from_status" varchar(50),
  "to_status" varchar(50),
  "note" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "erp_integration_request_events_request_idx" ON "erp_integration_request_events" ("request_id", "created_at");
CREATE INDEX IF NOT EXISTS "erp_integration_request_events_action_idx" ON "erp_integration_request_events" ("action", "created_at");

INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('erp.requests.review', 'مراجعة طلبات ERP', 'تكامل ERP', 'مراجعة طلبات ربط أنظمة التجار'),
  ('erp.connectors.manage', 'إدارة موصلات ERP', 'تكامل ERP', 'إدارة catalog الموصلات والإصدارات والحزم'),
  ('erp.requests.activate', 'تفعيل ربط ERP', 'تكامل ERP', 'اعتماد الطلب وفتح ERP Mode بعد الشهادة'),
  ('store.erp.requests.view', 'عرض طلبات ERP للمتجر', 'تكامل ERP', 'عرض حالة طلب ربط نظام محاسبي'),
  ('store.erp.requests.create', 'طلب ربط ERP', 'تكامل ERP', 'إنشاء طلب ربط نظام محاسبي للمتجر')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
