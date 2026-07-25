CREATE TYPE "public"."contract_status" AS ENUM('draft', 'pending_signature', 'pending_approval', 'active', 'near_expiry', 'expired', 'grace', 'frozen', 'terminated', 'renewed');--> statement-breakpoint
ALTER TYPE "public"."store_status" ADD VALUE 'frozen';--> statement-breakpoint
CREATE TABLE "contract_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"store_id" uuid,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"reason" text,
	"before_data" jsonb,
	"after_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(60) NOT NULL,
	"application_id" uuid,
	"store_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"template_id" uuid,
	"title" varchar(180) DEFAULT 'عقد تشغيل متجر' NOT NULL,
	"version" varchar(40) DEFAULT '1.0' NOT NULL,
	"body_snapshot" text,
	"signature_data_url" text,
	"status" "contract_status" DEFAULT 'active' NOT NULL,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"alert_before_days" integer DEFAULT 30 NOT NULL,
	"grace_ends_at" timestamp with time zone,
	"last_renewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contract_id_merchant_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."merchant_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contracts" ADD CONSTRAINT "merchant_contracts_application_id_merchant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."merchant_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contracts" ADD CONSTRAINT "merchant_contracts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contracts" ADD CONSTRAINT "merchant_contracts_merchant_id_users_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contracts" ADD CONSTRAINT "merchant_contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contracts" ADD CONSTRAINT "merchant_contracts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_events_contract_idx" ON "contract_events" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_events_store_idx" ON "contract_events" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "contract_events_action_idx" ON "contract_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "contract_events_created_at_idx" ON "contract_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_contracts_number_unique" ON "merchant_contracts" USING btree ("contract_number");--> statement-breakpoint
CREATE INDEX "merchant_contracts_store_idx" ON "merchant_contracts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "merchant_contracts_merchant_idx" ON "merchant_contracts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_contracts_status_idx" ON "merchant_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchant_contracts_expiry_idx" ON "merchant_contracts" USING btree ("end_at","alert_before_days");