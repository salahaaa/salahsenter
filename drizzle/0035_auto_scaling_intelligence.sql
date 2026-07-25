-- Auto Scaling Intelligence control plane and audit trail.
CREATE TABLE IF NOT EXISTS "platform_scaling_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mode" varchar(40) DEFAULT 'recommendation' NOT NULL,
  "direction" varchar(40) DEFAULT 'hold' NOT NULL,
  "severity" varchar(30) DEFAULT 'info' NOT NULL,
  "trigger" varchar(120) DEFAULT 'auto_scaling_intelligence' NOT NULL,
  "status" varchar(40) DEFAULT 'recommended' NOT NULL,
  "before_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "desired_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actor_id" uuid,
  "correlation_id" varchar(160),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "platform_scaling_events" ADD CONSTRAINT "platform_scaling_events_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "platform_scaling_events_created_at_idx" ON "platform_scaling_events" ("created_at");
CREATE INDEX IF NOT EXISTS "platform_scaling_events_mode_idx" ON "platform_scaling_events" ("mode", "status");
CREATE INDEX IF NOT EXISTS "platform_scaling_events_direction_idx" ON "platform_scaling_events" ("direction", "severity");
CREATE INDEX IF NOT EXISTS "platform_scaling_events_correlation_idx" ON "platform_scaling_events" ("correlation_id");
