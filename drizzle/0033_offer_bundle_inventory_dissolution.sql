-- Bundle inventory tracking and dissolution operations for promotional bundles.
ALTER TABLE "store_offer_collections" ADD COLUMN IF NOT EXISTS "bundle_initial_quantity" integer DEFAULT 0 NOT NULL;
ALTER TABLE "store_offer_collections" ADD COLUMN IF NOT EXISTS "bundle_remaining_quantity" integer DEFAULT 0 NOT NULL;
ALTER TABLE "store_offer_collections" ADD COLUMN IF NOT EXISTS "bundle_dissolved_quantity" integer DEFAULT 0 NOT NULL;
ALTER TABLE "store_offer_collections" ADD COLUMN IF NOT EXISTS "bundle_inventory_mode" varchar(40) DEFAULT 'direct' NOT NULL;
ALTER TABLE "store_offer_collections" ADD COLUMN IF NOT EXISTS "bundle_inventory_status" varchar(40) DEFAULT 'none' NOT NULL;

CREATE TABLE IF NOT EXISTS "store_offer_bundle_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "actor_id" uuid,
  "operation_type" varchar(40) NOT NULL,
  "quantity" integer NOT NULL,
  "before_remaining" integer NOT NULL,
  "after_remaining" integer NOT NULL,
  "items_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "note" text,
  "idempotency_key" varchar(180),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "store_offer_bundle_operations" ADD CONSTRAINT "store_offer_bundle_operations_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "store_offer_collections"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "store_offer_bundle_operations" ADD CONSTRAINT "store_offer_bundle_operations_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "store_offer_bundle_operations" ADD CONSTRAINT "store_offer_bundle_operations_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "store_offer_bundle_operations_offer_idx" ON "store_offer_bundle_operations" ("offer_id", "created_at");
CREATE INDEX IF NOT EXISTS "store_offer_bundle_operations_store_idx" ON "store_offer_bundle_operations" ("store_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "store_offer_bundle_operations_idempotency_unique" ON "store_offer_bundle_operations" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;

UPDATE "store_offer_collections"
SET "bundle_initial_quantity" = greatest("bundle_initial_quantity", 0),
    "bundle_remaining_quantity" = greatest("bundle_remaining_quantity", 0),
    "bundle_dissolved_quantity" = greatest("bundle_dissolved_quantity", 0)
WHERE "bundle_initial_quantity" < 0 OR "bundle_remaining_quantity" < 0 OR "bundle_dissolved_quantity" < 0;
