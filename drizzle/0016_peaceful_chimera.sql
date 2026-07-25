CREATE TABLE "order_dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_id" uuid,
	"file_url" text NOT NULL,
	"title" varchar(180),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_dispute_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_id" uuid,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"status" varchar(40) DEFAULT 'open' NOT NULL,
	"reason" varchar(120) NOT NULL,
	"description" text,
	"resolution" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_number" varchar(80) NOT NULL,
	"invoice_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(40) DEFAULT 'issued' NOT NULL,
	"seller_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"buyer_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"totals_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" varchar(80),
	"to_status" varchar(80) NOT NULL,
	"actor_id" uuid,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sku" varchar(120);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_code" varchar(120);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order_dispute_evidence" ADD CONSTRAINT "order_dispute_evidence_dispute_id_order_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."order_disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dispute_evidence" ADD CONSTRAINT "order_dispute_evidence_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dispute_messages" ADD CONSTRAINT "order_dispute_messages_dispute_id_order_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."order_disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dispute_messages" ADD CONSTRAINT "order_dispute_messages_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_disputes" ADD CONSTRAINT "order_disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_disputes" ADD CONSTRAINT "order_disputes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_disputes" ADD CONSTRAINT "order_disputes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_dispute_evidence_dispute_idx" ON "order_dispute_evidence" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "order_dispute_messages_dispute_idx" ON "order_dispute_messages" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "order_disputes_order_idx" ON "order_disputes" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "order_disputes_customer_idx" ON "order_disputes" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "order_disputes_store_idx" ON "order_disputes" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "order_invoices_order_unique" ON "order_invoices" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_invoices_number_unique" ON "order_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "order_invoices_status_idx" ON "order_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_status_history_actor_idx" ON "order_status_history" USING btree ("actor_id");