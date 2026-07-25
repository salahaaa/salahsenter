CREATE TABLE "offer_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"occasion_type" varchar(80) DEFAULT 'seasonal' NOT NULL,
	"description" text,
	"image_url" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"status" "content_status" DEFAULT 'active' NOT NULL,
	"is_homepage_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"severity" varchar(30) DEFAULT 'medium' NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text,
	"actor_id" uuid,
	"ip_address" varchar(80),
	"user_agent" text,
	"entity_type" varchar(120),
	"entity_id" varchar(160),
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommended_action" text,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_offer_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"store_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"image_url" text,
	"status" varchar(40) DEFAULT 'pending_review' NOT NULL,
	"admin_note" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_promoted" boolean DEFAULT false NOT NULL,
	"promotion_start" timestamp with time zone,
	"promotion_end" timestamp with time zone,
	"promotion_package" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"submitted_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_offer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"title" varchar(180),
	"image_url" text,
	"original_price" numeric(12, 2),
	"offer_price" numeric(12, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offer_campaigns" ADD CONSTRAINT "offer_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_collections" ADD CONSTRAINT "store_offer_collections_campaign_id_offer_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."offer_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_collections" ADD CONSTRAINT "store_offer_collections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_collections" ADD CONSTRAINT "store_offer_collections_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_collections" ADD CONSTRAINT "store_offer_collections_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_items" ADD CONSTRAINT "store_offer_items_offer_id_store_offer_collections_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."store_offer_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_items" ADD CONSTRAINT "store_offer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_offer_items" ADD CONSTRAINT "store_offer_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_campaigns_slug_unique" ON "offer_campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "offer_campaigns_visible_idx" ON "offer_campaigns" USING btree ("status","is_homepage_visible","sort_order");--> statement-breakpoint
CREATE INDEX "security_alerts_status_idx" ON "security_alerts" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "security_alerts_type_idx" ON "security_alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "security_alerts_actor_idx" ON "security_alerts" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "security_alerts_ip_idx" ON "security_alerts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "security_alerts_created_at_idx" ON "security_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "store_offer_collections_campaign_idx" ON "store_offer_collections" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "store_offer_collections_store_idx" ON "store_offer_collections" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "store_offer_collections_status_idx" ON "store_offer_collections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "store_offer_collections_promoted_idx" ON "store_offer_collections" USING btree ("is_promoted","promotion_start","promotion_end");--> statement-breakpoint
CREATE INDEX "store_offer_items_offer_idx" ON "store_offer_items" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "store_offer_items_product_idx" ON "store_offer_items" USING btree ("product_id");