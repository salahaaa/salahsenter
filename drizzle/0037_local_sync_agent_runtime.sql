-- Local Sync Agent runtime support: device registration and heartbeat.
CREATE TABLE IF NOT EXISTS "integration_agent_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_key" varchar(120) NOT NULL,
  "device_id" varchar(160) NOT NULL,
  "device_name" varchar(180),
  "store_id" uuid,
  "agent_version" varchar(80),
  "os" varchar(120),
  "connector_type" varchar(80),
  "status" varchar(40) DEFAULT 'offline' NOT NULL,
  "capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_heartbeat" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_seen_at" timestamp with time zone,
  "registered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "integration_agent_devices" ADD CONSTRAINT "integration_agent_devices_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "integration_agent_devices_client_device_unique" ON "integration_agent_devices" ("client_key", "device_id");
CREATE INDEX IF NOT EXISTS "integration_agent_devices_client_idx" ON "integration_agent_devices" ("client_key", "status");
CREATE INDEX IF NOT EXISTS "integration_agent_devices_store_idx" ON "integration_agent_devices" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "integration_agent_devices_last_seen_idx" ON "integration_agent_devices" ("last_seen_at");
