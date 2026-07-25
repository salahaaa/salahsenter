-- Owner-only sensitive control, two-owner recovery, and explicit QA identity marking.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_test_account" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "users_test_account_idx" ON "users" ("is_test_account", "status");

CREATE TABLE IF NOT EXISTS "platform_sensitive_control_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "password_hash" text NOT NULL,
  "initialized_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "initialized_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_rotated_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "platform_sensitive_control_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_sensitive_control_sessions_token_unique" ON "platform_sensitive_control_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "platform_sensitive_control_sessions_owner_expiry_idx" ON "platform_sensitive_control_sessions" ("owner_user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "platform_owner_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slot" integer NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "email_snapshot" varchar(255) NOT NULL,
  "status" varchar(40) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "replaced_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_owner_accounts_slot_unique" ON "platform_owner_accounts" ("slot");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_owner_accounts_user_unique" ON "platform_owner_accounts" ("user_id");

CREATE TABLE IF NOT EXISTS "prelaunch_reset_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "initiated_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "status" varchar(40) NOT NULL DEFAULT 'bootstrap_pending',
  "purge_summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "bootstrap_token_hash" varchar(128) NOT NULL,
  "bootstrap_expires_at" timestamp with time zone NOT NULL,
  "bootstrap_consumed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error_message" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "prelaunch_reset_runs_token_unique" ON "prelaunch_reset_runs" ("bootstrap_token_hash");
CREATE INDEX IF NOT EXISTS "prelaunch_reset_runs_status_expiry_idx" ON "prelaunch_reset_runs" ("status", "bootstrap_expires_at");

-- Rollback only after application code no longer reads these controls:
-- DROP TABLE IF EXISTS "prelaunch_reset_runs";
-- DROP TABLE IF EXISTS "platform_owner_accounts";
-- DROP TABLE IF EXISTS "platform_sensitive_control_sessions";
-- DROP TABLE IF EXISTS "platform_sensitive_control_settings";
-- DROP INDEX IF EXISTS "users_test_account_idx";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "is_test_account";
