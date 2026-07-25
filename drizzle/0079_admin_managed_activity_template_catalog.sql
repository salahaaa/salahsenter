CREATE TABLE IF NOT EXISTS "merchant_activity_template_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(120) NOT NULL,
  "name" varchar(180) NOT NULL,
  "description" text,
  "sector" varchar(120),
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_activity_template_catalog_code_unique" ON "merchant_activity_template_catalog" ("code");
CREATE INDEX IF NOT EXISTS "merchant_activity_template_catalog_status_sector_idx" ON "merchant_activity_template_catalog" ("status", "sector", "updated_at");
INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('activity_templates.manage', 'إدارة كتالوج قوالب الأنشطة', 'إدارة المنتجات', 'إنشاء وتعديل وتعطيل القطاعات الجاهزة للتجار')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
