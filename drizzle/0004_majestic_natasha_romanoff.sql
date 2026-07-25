CREATE TABLE "cms_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(180) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"type" varchar(80) DEFAULT 'page' NOT NULL,
	"excerpt" text,
	"content" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(120) NOT NULL,
	"scope" varchar(40) DEFAULT 'platform' NOT NULL,
	"wing_id" uuid,
	"store_id" uuid,
	"rate" numeric(6, 3) DEFAULT '0' NOT NULL,
	"fixed_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"min_commission" numeric(12, 2),
	"max_commission" numeric(12, 2),
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"code" varchar(120) NOT NULL,
	"version" varchar(40) DEFAULT '1.0' NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_key" varchar(80) DEFAULT 'main' NOT NULL,
	"parent_id" uuid,
	"title" varchar(160) NOT NULL,
	"url" text NOT NULL,
	"icon" varchar(80),
	"target" varchar(30) DEFAULT '_self' NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(140) NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"title_template" varchar(220) NOT NULL,
	"body_template" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(120) NOT NULL,
	"scope" "role_scope" DEFAULT 'store' NOT NULL,
	"description" text,
	"permission_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inheritance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(120) NOT NULL,
	"rate" numeric(6, 3) DEFAULT '0' NOT NULL,
	"included_in_price" boolean DEFAULT false NOT NULL,
	"country_id" uuid,
	"governorate_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_wing_id_wings_id_fk" FOREIGN KEY ("wing_id") REFERENCES "public"."wings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_governorate_id_governorates_id_fk" FOREIGN KEY ("governorate_id") REFERENCES "public"."governorates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_slug_unique" ON "cms_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cms_pages_type_idx" ON "cms_pages" USING btree ("type");--> statement-breakpoint
CREATE INDEX "cms_pages_status_idx" ON "cms_pages" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_rules_code_unique" ON "commission_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "commission_rules_scope_idx" ON "commission_rules" USING btree ("scope","wing_id","store_id");--> statement-breakpoint
CREATE INDEX "commission_rules_active_idx" ON "commission_rules" USING btree ("is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_templates_code_version_unique" ON "contract_templates" USING btree ("code","version");--> statement-breakpoint
CREATE INDEX "contract_templates_active_idx" ON "contract_templates" USING btree ("is_active","is_default");--> statement-breakpoint
CREATE INDEX "menu_items_menu_idx" ON "menu_items" USING btree ("menu_key","is_visible","sort_order");--> statement-breakpoint
CREATE INDEX "menu_items_parent_idx" ON "menu_items" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_code_channel_unique" ON "notification_templates" USING btree ("code","channel");--> statement-breakpoint
CREATE INDEX "notification_templates_active_idx" ON "notification_templates" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "role_templates_code_unique" ON "role_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "role_templates_scope_idx" ON "role_templates" USING btree ("scope","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rules_code_unique" ON "tax_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tax_rules_location_idx" ON "tax_rules" USING btree ("country_id","governorate_id");--> statement-breakpoint
CREATE INDEX "tax_rules_active_idx" ON "tax_rules" USING btree ("is_active","priority");