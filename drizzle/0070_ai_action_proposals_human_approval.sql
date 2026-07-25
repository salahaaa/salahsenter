CREATE TABLE IF NOT EXISTS "ai_action_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "store_id" uuid REFERENCES "stores"("id") ON DELETE cascade,
  "audience" varchar(30) NOT NULL,
  "task_type" varchar(100) NOT NULL,
  "title" varchar(220) NOT NULL,
  "description" text,
  "action_type" varchar(120) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "risk_level" varchar(30) DEFAULT 'low' NOT NULL,
  "status" varchar(40) DEFAULT 'pending_approval' NOT NULL,
  "provider" varchar(80) DEFAULT 'rules' NOT NULL,
  "model" varchar(120),
  "approved_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "approved_at" timestamp with time zone,
  "executed_at" timestamp with time zone,
  "execution_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ai_action_proposals_user_status_idx" ON "ai_action_proposals" ("user_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "ai_action_proposals_store_status_idx" ON "ai_action_proposals" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "ai_action_proposals_expiry_idx" ON "ai_action_proposals" ("status", "expires_at");
INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
 ('ai.assistant.use','استخدام مساعد الذكاء','الذكاء الاصطناعي','استخدام مساعد الذكاء الاصطناعي'),
 ('ai.proposals.approve','اعتماد اقتراحات الذكاء','الذكاء الاصطناعي','اعتماد اقتراحات الذكاء ضمن نطاق المستخدم'),
 ('store.ai.use','استخدام ذكاء المتجر','لوحة التاجر','تحليل وتشغيل اقتراحات الذكاء للمتجر'),
 ('store.ai.proposals.approve','اعتماد اقتراحات ذكاء المتجر','لوحة التاجر','اعتماد مسودات الذكاء للمتجر')
ON CONFLICT ("code") DO UPDATE SET "name"=EXCLUDED."name","group"=EXCLUDED."group","description"=EXCLUDED."description";
