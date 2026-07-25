-- Showcase product sale status for SHOWCASE_ONLY and premium catalog stores.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "showcase_status" varchar(40) DEFAULT 'AVAILABLE' NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "showcase_sold_at" timestamp with time zone;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "showcase_note" text;

UPDATE "products"
SET "showcase_status" = 'AVAILABLE'
WHERE "showcase_status" IS NULL OR "showcase_status" NOT IN ('AVAILABLE', 'SOLD', 'HIDDEN');

DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_showcase_status_check" CHECK ("showcase_status" IN ('AVAILABLE','SOLD','HIDDEN'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "products_showcase_status_idx" ON "products" ("store_id", "showcase_status", "status");
CREATE INDEX IF NOT EXISTS "products_showcase_sold_at_idx" ON "products" ("showcase_sold_at");
