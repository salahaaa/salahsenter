-- Private, expiring admin-only previews. Token is hashed; raw token never enters DB.
CREATE TABLE IF NOT EXISTS "experience_preview_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "scope" varchar(80) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "experience_preview_sessions_token_hash_unique" ON "experience_preview_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "experience_preview_sessions_owner_status_idx" ON "experience_preview_sessions" ("created_by", "status", "expires_at");
