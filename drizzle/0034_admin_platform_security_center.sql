-- Admin Platform Protection Center: incidents, health checks and structured logs.
CREATE TABLE IF NOT EXISTS "platform_incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_key" varchar(180) NOT NULL,
  "severity" varchar(30) DEFAULT 'warning' NOT NULL,
  "status" varchar(30) DEFAULT 'open' NOT NULL,
  "title" varchar(220) NOT NULL,
  "description" text,
  "affected_service" varchar(120) DEFAULT 'platform' NOT NULL,
  "source" varchar(80) DEFAULT 'security_center' NOT NULL,
  "root_cause" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "recommendation" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "platform_incidents" ADD CONSTRAINT "platform_incidents_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "platform_incidents_key_unique" ON "platform_incidents" ("incident_key");
CREATE INDEX IF NOT EXISTS "platform_incidents_status_idx" ON "platform_incidents" ("status", "severity");
CREATE INDEX IF NOT EXISTS "platform_incidents_service_idx" ON "platform_incidents" ("affected_service", "last_seen_at");
CREATE INDEX IF NOT EXISTS "platform_incidents_detected_idx" ON "platform_incidents" ("detected_at");

CREATE TABLE IF NOT EXISTS "platform_incident_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_id" uuid NOT NULL,
  "type" varchar(80) DEFAULT 'note' NOT NULL,
  "message" text NOT NULL,
  "actor_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "platform_incident_events" ADD CONSTRAINT "platform_incident_events_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "platform_incidents"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "platform_incident_events" ADD CONSTRAINT "platform_incident_events_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "platform_incident_events_incident_idx" ON "platform_incident_events" ("incident_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_incident_events_type_idx" ON "platform_incident_events" ("type");

CREATE TABLE IF NOT EXISTS "platform_health_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "check_key" varchar(160) NOT NULL,
  "service" varchar(120) NOT NULL,
  "status" varchar(30) NOT NULL,
  "latency_ms" integer,
  "message" text,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_health_checks_key_created_idx" ON "platform_health_checks" ("check_key", "created_at");
CREATE INDEX IF NOT EXISTS "platform_health_checks_service_idx" ON "platform_health_checks" ("service", "status");

CREATE TABLE IF NOT EXISTS "platform_structured_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "level" varchar(30) DEFAULT 'info' NOT NULL,
  "category" varchar(80) DEFAULT 'system' NOT NULL,
  "service" varchar(120) DEFAULT 'platform' NOT NULL,
  "message" text NOT NULL,
  "correlation_id" varchar(160),
  "actor_id" uuid,
  "request_path" text,
  "ip_address" varchar(80),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "platform_structured_logs" ADD CONSTRAINT "platform_structured_logs_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "platform_structured_logs_level_idx" ON "platform_structured_logs" ("level", "created_at");
CREATE INDEX IF NOT EXISTS "platform_structured_logs_service_idx" ON "platform_structured_logs" ("service", "created_at");
CREATE INDEX IF NOT EXISTS "platform_structured_logs_correlation_idx" ON "platform_structured_logs" ("correlation_id");
