export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/** Baseline machine-readable contract; expanded endpoint-by-endpoint with API migrations. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Salah Center Mall OS API", version: "2026-07-14", description: "Typed API contract baseline. Authenticated endpoints use the mall_session cookie and CSRF header for browser mutations; integration endpoints use their own signed authentication." },
    servers: [{ url: origin }],
    components: {
      schemas: {
        ApiError: { type: "object", required: ["success", "message"], properties: { success: { const: false }, message: { type: "string" }, details: {} } },
        Pagination: { type: "object", properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, hasNext: { type: "boolean" }, totalCount: { type: "integer" } }, required: ["page", "pageSize", "hasNext"] },
        RequestCorrelation: { type: "string", description: "x-request-id returned by the response and persisted into audit events when applicable." }
      },
      securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "mall_session" }, integrationBearer: { type: "http", scheme: "bearer" } }
    },
    paths: {
      "/api/health": { get: { summary: "Public health check", responses: { "200": { description: "Service health" } } } },
      "/api/auth/login": { post: { summary: "Login", requestBody: { required: true }, responses: { "200": { description: "Session created" }, "401": { "$ref": "#/components/schemas/ApiError" } } } },
      "/api/merchant/products": { get: { summary: "Paginated merchant product list", security: [{ sessionCookie: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer" } }, { name: "pageSize", in: "query", schema: { type: "integer", maximum: 100 } }, { name: "q", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Product list" } } }, post: { summary: "Create merchant product", security: [{ sessionCookie: [] }], responses: { "201": { description: "Product created" } } } },
      "/api/orders": { get: { summary: "Paginated order list", security: [{ sessionCookie: [] }], responses: { "200": { description: "Orders" } } }, post: { summary: "Create order", security: [{ sessionCookie: [] }], responses: { "201": { description: "Order created" } } } },
      "/api/admin/audit-log": { get: { summary: "Filter/export audit events", security: [{ sessionCookie: [] }], parameters: [{ name: "correlationId", in: "query", schema: { type: "string" } }, { name: "format", in: "query", schema: { enum: ["json", "csv"] } }], responses: { "200": { description: "Audit list/export" } } } },
      "/api/ads/events": { post: { summary: "Privacy-aware sponsored impression/click ingestion", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["eventType", "campaignId", "placement", "visitorId"], properties: { eventType: { enum: ["impression", "click"] }, campaignId: { type: "string", format: "uuid" }, placement: { enum: ["homepage_marketplace_ads", "homepage_sponsored_products", "homepage_featured_products", "homepage_promo", "homepage_hero", "homepage_featured_stores", "homepage_trending_stores", "homepage_latest_stores", "homepage_trending_products", "homepage_latest_products", "homepage_promoted_offers", "homepage_today_offers", "homepage_weekend_offers", "homepage_seasonal_offers", "homepage_featured_wings", "search_results", "category_listing", "storefront"] }, visitorId: { type: "string" }, productId: { type: "string", format: "uuid" }, attributionToken: { type: "string", format: "uuid" } } } } } }, responses: { "201": { description: "Telemetry acknowledgement; raw identifiers are never persisted" }, "429": { "$ref": "#/components/schemas/ApiError" } } } },
      "/api/merchant/ad-campaigns/recommendations": { get: { summary: "Merchant bid/budget advisory", security: [{ sessionCookie: [] }], responses: { "200": { description: "Explainable seven-day campaign recommendations" } } } },
      "/api/merchant/ads/invoices": { get: { summary: "Merchant ad invoice history", security: [{ sessionCookie: [] }], responses: { "200": { description: "Issued ad invoices" } } } },
      "/api/admin/ads/invoices": { get: { summary: "Admin ad invoices", security: [{ sessionCookie: [] }], responses: { "200": { description: "Invoice collection queue" } } }, post: { summary: "Issue previous-day accrued ad invoices", security: [{ sessionCookie: [] }], responses: { "200": { description: "Idempotent issuance run" } } }, patch: { summary: "Settle or void an ad invoice", security: [{ sessionCookie: [] }], responses: { "200": { description: "Invoice settlement recorded" } } } },
      "/api/admin/platform-revenue/terms": { post: { summary: "Set merchant platform revenue model: rent, commission or hybrid", security: [{ sessionCookie: [] }], responses: { "201": { description: "Revenue terms saved" } } } },
      "/api/admin/platform-revenue/promotion-agreements": { post: { summary: "Set separate promotion/visibility agreement", security: [{ sessionCookie: [] }], responses: { "201": { description: "Promotion agreement saved" } } } },
      "/api/admin/platform-revenue/statements": { get: { summary: "Consolidated platform revenue statements", security: [{ sessionCookie: [] }], responses: { "200": { description: "Statements" } } }, post: { summary: "Issue/rebuild consolidated monthly statement", security: [{ sessionCookie: [] }], responses: { "200": { description: "Statement issued or awaiting approved sales report" } } }, patch: { summary: "Review platform-revenue statement settlement", security: [{ sessionCookie: [] }], responses: { "200": { description: "Settlement status updated" } } } },
      "/api/merchant/platform-revenue/sales-reports": { post: { summary: "Submit monthly sales report for commission", security: [{ sessionCookie: [] }], responses: { "201": { description: "Report submitted for admin approval" } } } },
      "/api/integrations/sales-reports": { post: { summary: "ERP/API submits a merchant sales report; admin approval remains required", security: [{ integrationBearer: [] }], responses: { "201": { description: "Report submitted" } } } },
      "/api/merchant/erp-integration-requests": { get: { summary: "Merchant ERP onboarding requests", security: [{ sessionCookie: [] }], responses: { "200": { description: "Request history and active generic connectors" } } }, post: { summary: "Submit provider-neutral ERP onboarding request", security: [{ sessionCookie: [] }], responses: { "201": { description: "Request pending admin review" } } } },
      "/api/admin/erp-integration-requests": { get: { summary: "Admin ERP onboarding queue", security: [{ sessionCookie: [] }], responses: { "200": { description: "Requests, connector catalog and certifications" } } }, patch: { summary: "Review, assign connector or activate a certified ERP request", security: [{ sessionCookie: [] }], responses: { "200": { description: "Request lifecycle updated" } } } },
      "/api/integrations/onboarding/mapping": { post: { summary: "Provisional agent submits External ID mapping readiness before production ERP mode", security: [{ integrationBearer: [] }], responses: { "201": { description: "Mapping readiness accepted" } } } },
      "/api/integrations/{resource}": { get: { summary: "ERP pull resource", security: [{ integrationBearer: [] }], parameters: [{ name: "resource", in: "path", required: true, schema: { enum: ["products", "inventory", "orders", "invoices", "events"] } }], responses: { "200": { description: "Integration pull page" } } } }
    }
  }, { headers: { "Cache-Control": "public, max-age=3600", "x-openapi-version": "2026-07-14" } });
}
