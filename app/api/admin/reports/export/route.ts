export const dynamic = "force-dynamic";

import { desc, sql } from "drizzle-orm";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, orders, products, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/[\r\n]+/g, " ").replace(/"/g, '""')}"`; }

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "finance.reports.export");
    const [ordersRows, storesRows, productsRows] = await Promise.all([
      db.select({ orderNumber: orders.orderNumber, status: orders.statusCode, paymentStatus: orders.paymentStatus, amount: orders.grandTotal, currency: orders.currency, createdAt: orders.createdAt }).from(orders).orderBy(desc(orders.createdAt)).limit(10_000),
      db.select({ name: stores.name, orders: stores.orderCount, sales: stores.salesTotal, rating: stores.ratingAverage }).from(stores).orderBy(desc(stores.salesTotal)).limit(1_000),
      db.select({ name: products.name, sold: products.soldCount, rating: products.ratingAverage }).from(products).orderBy(desc(products.soldCount)).limit(1_000)
    ]);
    const rows = [
      ["section", "name_or_number", "status", "payment", "amount", "currency", "rating", "created_at"],
      ...ordersRows.map((row) => ["orders", row.orderNumber, row.status, row.paymentStatus, row.amount, row.currency, "", row.createdAt.toISOString()]),
      ...storesRows.map((row) => ["stores", row.name, row.orders, "", row.sales, "YER", row.rating, ""]),
      ...productsRows.map((row) => ["products", row.name, row.sold, "", "", "", row.rating, ""])
    ];
    return new Response(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=admin-platform-report.csv", "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "تعذر تصدير التقرير الإداري");
  }
}
