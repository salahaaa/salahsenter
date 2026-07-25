import ExcelJS from "exceljs";

export type ImportedProductRow = {
  sourceRow: number;
  name: string;
  categoryName: string;
  brand: string;
  barcode: string;
  basePrice: string;
  stockQuantity: string;
  mainImageUrl: string;
  description: string;
  errors: string[];
};

const aliases: Record<keyof Omit<ImportedProductRow, "sourceRow" | "errors">, string[]> = {
  name: ["name", "product", "product_name", "اسم", "اسم المنتج", "المنتج"],
  categoryName: ["category", "category_name", "تصنيف", "الصنف", "القسم"],
  brand: ["brand", "ماركة", "الماركة", "علامة", "العلامة التجارية"],
  barcode: ["barcode", "باركود", "كود باركود"],
  basePrice: ["price", "base_price", "السعر", "سعر"],
  stockQuantity: ["stock", "quantity", "المخزون", "الكمية"],
  mainImageUrl: ["image", "image_url", "الصورة", "رابط الصورة"],
  description: ["description", "الوصف", "تفاصيل"]
};

export function normalizeImportHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

export function mapProductImportHeader(header: string) {
  const normalized = normalizeImportHeader(header);
  for (const [field, names] of Object.entries(aliases)) {
    if (names.map(normalizeImportHeader).includes(normalized)) return field as keyof Omit<ImportedProductRow, "sourceRow" | "errors">;
  }
  return null;
}

function csvCells(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowFromValues(headers: Array<keyof Omit<ImportedProductRow, "sourceRow" | "errors"> | null>, values: string[], sourceRow: number): ImportedProductRow {
  const output: Omit<ImportedProductRow, "errors"> = { sourceRow, name: "", categoryName: "", brand: "", barcode: "", basePrice: "", stockQuantity: "", mainImageUrl: "", description: "" };
  headers.forEach((header, index) => { if (header) output[header] = String(values[index] || "").trim(); });
  const errors: string[] = [];
  if (!output.name) errors.push("اسم المنتج مفقود");
  if (output.basePrice && (!Number.isFinite(Number(output.basePrice)) || Number(output.basePrice) < 0)) errors.push("السعر غير صالح");
  if (output.stockQuantity && (!Number.isInteger(Number(output.stockQuantity)) || Number(output.stockQuantity) < 0)) errors.push("المخزون يجب أن يكون رقمًا صحيحًا غير سالب");
  return { ...output, errors };
}

export function parseProductCsv(text: string) {
  const rows = csvCells(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const headers = rows[0].map((header) => mapProductImportHeader(header));
  return rows.slice(1).map((values, index) => rowFromValues(headers, values, index + 2));
}

export async function parseProductExcel(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerValues = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => mapProductImportHeader(String(value || "")));
  const rows: ImportedProductRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as unknown[]).slice(1).map((cell: any) => typeof cell === "object" && cell?.text ? String(cell.text) : String(cell || ""));
    if (values.some((value) => value.trim())) rows.push(rowFromValues(headerValues, values, rowNumber));
  });
  return rows;
}

export async function parseProductImportFile(buffer: Buffer, fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension === "xlsx" || extension === "xls" ? parseProductExcel(buffer) : parseProductCsv(buffer.toString("utf8"));
}
