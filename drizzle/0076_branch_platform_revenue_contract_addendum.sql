-- New branch approvals use the unified platform-revenue model only after a
-- signed/approved addendum to the parent contract. Existing legacy branch
-- invoices remain untouched.
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "financial_mode" varchar(40) DEFAULT 'legacy_branch_invoice' NOT NULL;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "revenue_model" varchar(40) DEFAULT 'monthly_rent' NOT NULL;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "commission_rate" numeric(6,3) DEFAULT '0' NOT NULL;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "due_days" integer DEFAULT 7 NOT NULL;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "grace_days" integer DEFAULT 7 NOT NULL;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "parent_contract_id" uuid REFERENCES "merchant_contracts"("id") ON DELETE set null;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "contract_addendum_id" uuid REFERENCES "merchant_contract_addendums"("id") ON DELETE set null;
ALTER TABLE "store_branch_profiles" ADD COLUMN IF NOT EXISTS "revenue_terms_id" uuid REFERENCES "merchant_revenue_terms"("id") ON DELETE set null;
CREATE INDEX IF NOT EXISTS "store_branch_profiles_financial_idx" ON "store_branch_profiles" ("financial_mode", "approval_status", "parent_contract_id");
CREATE INDEX IF NOT EXISTS "store_branch_profiles_addendum_idx" ON "store_branch_profiles" ("contract_addendum_id");
