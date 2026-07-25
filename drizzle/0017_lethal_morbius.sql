CREATE TABLE "platform_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_role_id" uuid,
	"direct_role_id" uuid,
	"employee_number" varchar(80) NOT NULL,
	"job_title" varchar(140),
	"department_group" varchar(140),
	"national_id" varchar(80),
	"address" text,
	"notes" text,
	"hired_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_employees" ADD COLUMN "group_role_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_group_role_id_roles_id_fk" FOREIGN KEY ("group_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_direct_role_id_roles_id_fk" FOREIGN KEY ("direct_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_employees_user_unique" ON "platform_employees" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_employees_number_unique" ON "platform_employees" USING btree ("employee_number");--> statement-breakpoint
CREATE INDEX "platform_employees_group_role_idx" ON "platform_employees" USING btree ("group_role_id");--> statement-breakpoint
CREATE INDEX "platform_employees_direct_role_idx" ON "platform_employees" USING btree ("direct_role_id");--> statement-breakpoint
CREATE INDEX "platform_employees_status_idx" ON "platform_employees" USING btree ("status");--> statement-breakpoint
ALTER TABLE "store_employees" ADD CONSTRAINT "store_employees_group_role_id_roles_id_fk" FOREIGN KEY ("group_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_employees_group_role_idx" ON "store_employees" USING btree ("group_role_id");