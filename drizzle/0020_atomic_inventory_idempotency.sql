CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" varchar(80) NOT NULL,
  "key" varchar(180) NOT NULL,
  "user_id" uuid,
  "request_hash" text NOT NULL,
  "status" varchar(30) DEFAULT 'processing' NOT NULL,
  "response_body" jsonb,
  "status_code" integer,
  "locked_until" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_scope_key_unique" ON "idempotency_keys" ("scope", "key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_user_idx" ON "idempotency_keys" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idempotency_keys_expiry_idx" ON "idempotency_keys" ("expires_at");
CREATE INDEX IF NOT EXISTS "idempotency_keys_status_idx" ON "idempotency_keys" ("status", "locked_until");

ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "reference_type" varchar(80);
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "reference_id" uuid;

CREATE INDEX IF NOT EXISTS "inventory_movements_reference_idx" ON "inventory_movements" ("reference_type", "reference_id");

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_order_variant_reserve_unique"
ON "inventory_movements" ("reference_id", "variant_id", "type")
WHERE "reference_type" = 'order' AND "type" = 'reserve';

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_order_variant_release_unique"
ON "inventory_movements" ("reference_id", "variant_id", "type")
WHERE "reference_type" = 'order' AND "type" = 'release';

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_order_variant_return_unique"
ON "inventory_movements" ("reference_id", "variant_id", "type")
WHERE "reference_type" = 'order' AND "type" = 'return';

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_order_variant_deduct_unique"
ON "inventory_movements" ("reference_id", "variant_id", "type")
WHERE "reference_type" = 'order' AND "type" = 'deduct';
