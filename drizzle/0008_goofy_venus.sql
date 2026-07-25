ALTER TABLE "store_employees" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "store_employees" ADD COLUMN "employee_code" varchar(80);--> statement-breakpoint
ALTER TABLE "store_employees" ADD COLUMN "national_id" varchar(80);--> statement-breakpoint
ALTER TABLE "store_employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "store_employees" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "store_employees" ADD COLUMN "hired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_employees" ADD CONSTRAINT "store_employees_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_employees_store_code_unique" ON "store_employees" USING btree ("store_id","employee_code");--> statement-breakpoint
CREATE INDEX "store_employees_role_idx" ON "store_employees" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "store_employees_status_idx" ON "store_employees" USING btree ("status");