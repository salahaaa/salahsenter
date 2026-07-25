-- Manual financial checkpoint for merchant-requested homepage exposure. It is
-- an operational approval record, not a payment capture or settlement.
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "financial_checkpoint_status" varchar(40) DEFAULT 'awaiting_invoice' NOT NULL;
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "financial_reference" varchar(180);
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "financial_note" text;
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "financial_checked_by" uuid REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "home_exposure_requests" ADD COLUMN IF NOT EXISTS "financial_checked_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "home_exposure_requests_financial_status_idx" ON "home_exposure_requests" ("financial_checkpoint_status", "status", "created_at");
