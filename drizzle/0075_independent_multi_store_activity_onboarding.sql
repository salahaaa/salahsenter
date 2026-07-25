-- Independent stores/activities owned by the same merchant account. This does
-- not alter the existing branch/group model.
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "application_type" varchar(40) DEFAULT 'initial_store' NOT NULL;
ALTER TABLE "merchant_applications" ADD COLUMN IF NOT EXISTS "identity_reused_from_application_id" uuid REFERENCES "merchant_applications"("id") ON DELETE set null;
CREATE INDEX IF NOT EXISTS "merchant_applications_user_type_status_idx" ON "merchant_applications" ("applicant_user_id", "application_type", "status", "created_at");
CREATE INDEX IF NOT EXISTS "merchant_applications_identity_reuse_idx" ON "merchant_applications" ("identity_reused_from_application_id");
