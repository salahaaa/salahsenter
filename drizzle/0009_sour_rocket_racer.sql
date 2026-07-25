ALTER TABLE "payment_methods" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_methods_store_idx" ON "payment_methods" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "shipping_methods_store_idx" ON "shipping_methods" USING btree ("store_id");