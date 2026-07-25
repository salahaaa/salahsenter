-- Operational audit categories for finance, inventory, administration and security.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "category" varchar(40) DEFAULT 'administrative' NOT NULL;

UPDATE "audit_logs"
SET "category" = CASE
  WHEN lower("entity_type") ~ '(password|session|login|mfa|webhook|auth)' THEN 'security'
  WHEN lower("entity_type") ~ '(payment|payout|refund|ledger|wallet|settlement|invoice|finance)' THEN 'financial'
  WHEN lower("entity_type") ~ '(inventory|stock|variant|reservation)' THEN 'inventory'
  WHEN lower("entity_type") LIKE 'system.%' THEN 'system'
  ELSE 'administrative'
END
WHERE "category" IS NULL OR "category" = 'administrative';

CREATE INDEX IF NOT EXISTS "audit_logs_category_created_idx" ON "audit_logs" ("category", "created_at");
