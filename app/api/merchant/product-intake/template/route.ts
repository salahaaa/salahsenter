export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { fail, handleApiError } from "@/lib/api";

const columns = ["name", "category_name", "brand", "barcode", "base_price", "stock_quantity", "main_image_url", "description"];
const sample = ["مثال منتج", "القسم الرئيسي", "العلامة", "1234567890123", "10000", "10", "https://example.com/product.jpg", "وصف مختصر للمنتج"];
const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بالحساب", 403);
    const body = `\uFEFF${columns.map(cell).join(",")}\n${sample.map(cell).join(",")}\n`;
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=product-import-template.csv", "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, "تعذر إنشاء قالب استيراد المنتجات"); }
}
