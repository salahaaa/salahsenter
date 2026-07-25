-- Accounting Integration Architecture: API clients and queue-ready integration outbox.
CREATE TABLE IF NOT EXISTS "integration_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_key" varchar(120) NOT NULL,
  "name" varchar(180) NOT NULL,
  "provider" varchar(80) DEFAULT 'accounting' NOT NULL,
  "token_hash" text NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "store_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_clients_client_key_unique" ON "integration_clients" ("client_key");
CREATE INDEX IF NOT EXISTS "integration_clients_provider_status_idx" ON "integration_clients" ("provider", "status");
CREATE INDEX IF NOT EXISTS "integration_clients_last_seen_idx" ON "integration_clients" ("last_seen_at");

CREATE TABLE IF NOT EXISTS "integration_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(80) DEFAULT 'accounting' NOT NULL,
  "direction" varchar(30) DEFAULT 'outbound' NOT NULL,
  "event_type" varchar(120) NOT NULL,
  "entity_type" varchar(80) NOT NULL,
  "entity_id" varchar(160),
  "store_id" uuid,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 10 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "processed_at" timestamp with time zone,
  "last_error" text,
  "dedupe_key" varchar(220),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "integration_events_provider_status_idx" ON "integration_events" ("provider", "status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "integration_events_entity_idx" ON "integration_events" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "integration_events_store_idx" ON "integration_events" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "integration_events_event_type_idx" ON "integration_events" ("event_type", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_events_dedupe_unique" ON "integration_events" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL;
