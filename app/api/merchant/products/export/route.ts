export const dynamic = "force-dynamic";

import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { fail, handleApiError } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";

const cell = (value: unknown) => `"${String(value ?? "").replace(/[\r\n]+/g, " ").replace(/"/g, '""')}"`;

export async function GET(request: Request) {
  try {
    const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "products.export"))) return fail("لا تملك صلاحية تصدير المنتجات", 403);
    const url = new URL(request.url); const q = url.searchParams.get("q") || ""; const status = url.searchParams.get("status") || "";
    const conditions: SQL[] = [eq(products.storeId, store.id)];
    if (q) { const term = `%${q}%`; conditions.push(or(ilike(products.name, term), ilike(products.productCode, term), ilike(products.barcode, term))!); }
    if (["draft", "review", "active", "paused", "inactive", "archived"].includes(status)) conditions.push(eq(products.status, status as any));
    const rows = await db.select({ name: products.name, englishName: products.englishName, productCode: products.productCode, barcode: products.barcode, brand: products.brand, status: products.status, basePrice: products.basePrice, specifications: products.specifications, createdAt: products.createdAt }).from(products).where(and(...conditions)).orderBy(products.name).limit(10_000);
    const header = ["name", "english_name", "product_code", "barcode", "brand", "status", "base_price", "specifications", "created_at"];
    const body = `\uFEFF${header.map(cell).join(",")}\n${rows.map((row) => [row.name, row.englishName, row.productCode, row.barcode, row.brand, row.status, row.basePrice, JSON.stringify(row.specifications), row.createdAt.toISOString()].map(cell).join(",")).join("\n")}`;
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=merchant-products.csv", "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, "تعذر تصدير المنتجات"); }
}
