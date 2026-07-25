export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { enrichProductDraft, getStoreCategories, parseProductTextToDraft } from "@/lib/enterprise/product-intake";
import { parseProductImportFile } from "@/lib/products/import-file-parser";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("لم يتم رفع ملف", 422);
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) return fail("حجم ملف الاستيراد غير صالح؛ الحد 10MB", 413);
    const rows = await parseProductImportFile(Buffer.from(await file.arrayBuffer()), file.name);
    if (rows.length > 500) return fail("الحد الأقصى للاستيراد في الدفعة 500 صف", 422);
    const categories = await getStoreCategories(store.id);
    const drafts = [];
    for (const row of rows) {
      const text = [row.name, row.categoryName, row.brand, row.description].filter(Boolean).join(" ") || `منتج ${row.sourceRow}`;
      const parsed = parseProductTextToDraft(text, categories);
      const draft = await enrichProductDraft(store.id, {
        ...parsed,
        name: row.name || parsed.name,
        categoryName: row.categoryName || parsed.categoryName,
        brand: row.brand || parsed.brand,
        barcode: row.barcode || undefined,
        basePrice: row.basePrice ? Number(row.basePrice) : parsed.basePrice,
        stockQuantity: row.stockQuantity ? Number(row.stockQuantity) : parsed.stockQuantity,
        mainImageUrl: row.mainImageUrl || parsed.mainImageUrl,
        description: row.description || parsed.description,
        sourceRow: row.sourceRow,
        errors: row.errors
      } as any);
      drafts.push(draft);
    }
    return ok({ drafts, totalRows: rows.length, validRows: rows.filter((row) => !row.errors.length).length, invalidRows: rows.filter((row) => row.errors.length).length, sourceFileName: file.name, message: "تمت قراءة الملف وتجهيز معاينة الأخطاء قبل الحفظ" });
  } catch (error) {
    return handleApiError(error, "تعذر قراءة ملف المنتجات");
  }
}
