import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseProductCsv, parseProductImportFile } from "@/lib/products/import-file-parser";
import { parseProductTextToDraft } from "@/lib/enterprise/product-intake";

describe("product intake mapping", () => {
  it("maps Arabic CSV headers to the correct draft fields and flags invalid rows", () => {
    const rows = parseProductCsv("اسم المنتج,القسم,الماركة,باركود,السعر,المخزون,رابط الصورة,الوصف\nقميص قطني,أزياء,نايك,12345,12000,8,https://cdn.example/shirt.jpg,وصف القميص\n,أزياء,,,سعر-خاطئ,-1,,");
    expect(rows[0]).toMatchObject({ sourceRow: 2, name: "قميص قطني", categoryName: "أزياء", brand: "نايك", barcode: "12345", basePrice: "12000", stockQuantity: "8", mainImageUrl: "https://cdn.example/shirt.jpg", description: "وصف القميص", errors: [] });
    expect(rows[1].errors).toEqual(expect.arrayContaining(["اسم المنتج مفقود", "السعر غير صالح", "المخزون يجب أن يكون رقمًا صحيحًا غير سالب"]));
  });

  it("maps XLSX headers and preserves description cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Products");
    sheet.addRow(["name", "category", "brand", "price", "stock", "description"]);
    sheet.addRow(["هاتف ذكي", "إلكترونيات", "Samsung", 50000, 3, "وصف مفصل للهاتف"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseProductImportFile(buffer, "catalog.xlsx");
    expect(rows[0]).toMatchObject({ sourceRow: 2, name: "هاتف ذكي", categoryName: "إلكترونيات", brand: "Samsung", basePrice: "50000", stockQuantity: "3", description: "وصف مفصل للهاتف", errors: [] });
  });

  it("maps voice/text product details into description, sizes, colors, price and stock variants", () => {
    const categories = [{ id: "11111111-1111-4111-8111-111111111111", name: "أزياء" }];
    const draft = parseProductTextToDraft("قميص رجالي قطني أزرق مقاس M و L و XL بسعر 12000 ومخزون 20", categories);
    expect(draft.categoryId).toBe(categories[0].id);
    expect(draft.basePrice).toBe(12000);
    expect(draft.stockQuantity).toBe(20);
    expect(draft.description).toContain("قميص");
    expect(draft.attributes?.["اللون"]).toBe("أزرق");
    expect(draft.variants?.length).toBeGreaterThanOrEqual(3);
    expect(draft.variants?.every((variant) => variant.price === 12000 && variant.stockQuantity === 20)).toBe(true);
  });

  it("keeps an uploaded image URL attached to every generated variant when the image route enriches a draft", () => {
    const draft = parseProductTextToDraft("حذاء أسود مقاس 42 بسعر 9000", []);
    const imageUrl = "https://cdn.example/shoe.jpg";
    const enriched = { ...draft, mainImageUrl: imageUrl, variants: (draft.variants || []).map((variant) => ({ ...variant, imageUrl, images: [imageUrl] })) };
    expect(enriched.mainImageUrl).toBe(imageUrl);
    expect(enriched.variants?.every((variant) => variant.imageUrl === imageUrl && variant.images?.[0] === imageUrl)).toBe(true);
  });
});
