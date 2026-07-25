-- Dynamic Homepage Exposure & Revenue Engine.
-- Additive only. Rollback: drop the three triggers/functions, the index, then
-- ad_campaign_delivery_counters after the application no longer reads it.
CREATE TABLE IF NOT EXISTS "ad_campaign_delivery_counters" (
  "campaign_id" uuid PRIMARY KEY REFERENCES "ad_campaigns"("id") ON DELETE cascade,
  "impressions" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "clean_clicks" integer DEFAULT 0 NOT NULL,
  "conversions" integer DEFAULT 0 NOT NULL,
  "attributed_revenue" numeric(14,2) DEFAULT '0' NOT NULL,
  "platform_revenue" numeric(14,2) DEFAULT '0' NOT NULL,
  "last_impression_at" timestamp with time zone,
  "last_click_at" timestamp with time zone,
  "last_conversion_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ad_campaigns_placement_status_window_idx" ON "ad_campaigns" ("placement_id", "status", "starts_at", "ends_at");

CREATE OR REPLACE FUNCTION "ad_delivery_counter_on_impression"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "ad_campaign_delivery_counters" ("campaign_id", "impressions", "last_impression_at", "updated_at")
  VALUES (NEW."campaign_id", 1, NEW."created_at", now())
  ON CONFLICT ("campaign_id") DO UPDATE SET
    "impressions" = "ad_campaign_delivery_counters"."impressions" + 1,
    "last_impression_at" = EXCLUDED."last_impression_at",
    "updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "ad_delivery_counter_on_click"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "ad_campaign_delivery_counters" ("campaign_id", "clicks", "clean_clicks", "last_click_at", "updated_at")
  VALUES (NEW."campaign_id", 1, CASE WHEN NEW."fraud_status" = 'clean' THEN 1 ELSE 0 END, NEW."created_at", now())
  ON CONFLICT ("campaign_id") DO UPDATE SET
    "clicks" = "ad_campaign_delivery_counters"."clicks" + 1,
    "clean_clicks" = "ad_campaign_delivery_counters"."clean_clicks" + CASE WHEN NEW."fraud_status" = 'clean' THEN 1 ELSE 0 END,
    "last_click_at" = EXCLUDED."last_click_at",
    "updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "ad_delivery_counter_on_billing"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" IN ('accrued', 'invoiced', 'paid') THEN
    INSERT INTO "ad_campaign_delivery_counters" ("campaign_id", "platform_revenue", "updated_at")
    VALUES (NEW."campaign_id", NEW."amount", now())
    ON CONFLICT ("campaign_id") DO UPDATE SET
      "platform_revenue" = "ad_campaign_delivery_counters"."platform_revenue" + NEW."amount",
      "updated_at" = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "ad_delivery_counter_on_conversion"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."status" = 'delivered' THEN
    RETURN NEW;
  END IF;
  IF NEW."status" = 'delivered' THEN
    INSERT INTO "ad_campaign_delivery_counters" ("campaign_id", "conversions", "attributed_revenue", "last_conversion_at", "updated_at")
    VALUES (NEW."campaign_id", 1, NEW."conversion_value", COALESCE(NEW."delivered_at", now()), now())
    ON CONFLICT ("campaign_id") DO UPDATE SET
      "conversions" = "ad_campaign_delivery_counters"."conversions" + 1,
      "attributed_revenue" = "ad_campaign_delivery_counters"."attributed_revenue" + NEW."conversion_value",
      "last_conversion_at" = EXCLUDED."last_conversion_at",
      "updated_at" = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ad_delivery_counter_impression_trigger" ON "ad_impressions";
CREATE TRIGGER "ad_delivery_counter_impression_trigger" AFTER INSERT ON "ad_impressions"
FOR EACH ROW EXECUTE FUNCTION "ad_delivery_counter_on_impression"();

DROP TRIGGER IF EXISTS "ad_delivery_counter_click_trigger" ON "ad_clicks";
CREATE TRIGGER "ad_delivery_counter_click_trigger" AFTER INSERT ON "ad_clicks"
FOR EACH ROW EXECUTE FUNCTION "ad_delivery_counter_on_click"();

DROP TRIGGER IF EXISTS "ad_delivery_counter_billing_trigger" ON "ad_billing";
CREATE TRIGGER "ad_delivery_counter_billing_trigger" AFTER INSERT ON "ad_billing"
FOR EACH ROW EXECUTE FUNCTION "ad_delivery_counter_on_billing"();

DROP TRIGGER IF EXISTS "ad_delivery_counter_conversion_trigger" ON "ad_order_attributions";
CREATE TRIGGER "ad_delivery_counter_conversion_trigger" AFTER INSERT OR UPDATE OF "status" ON "ad_order_attributions"
FOR EACH ROW EXECUTE FUNCTION "ad_delivery_counter_on_conversion"();
