export type VisionResult = { available: boolean; provider: string; text: string; structured: Record<string, unknown> | null; reason?: string };

/** Vision/OCR is deliberately unavailable in rules mode; it never fabricates image or invoice facts. */
export async function analyzeAiImage(input: { imageUrl: string; purpose: "product_specs" | "supplier_invoice" }) : Promise<VisionResult> {
  const provider = (process.env.AI_PROVIDER || "rules").toLowerCase();
  if (provider !== "openai" || !process.env.OPENAI_API_KEY) return { available: false, provider: "rules", text: "يتطلب استخراج المواصفات من الصورة أو OCR للفواتير مزود Vision فعلياً. لم يتم تحليل الصورة في وضع rules.", structured: null, reason: "vision_provider_not_configured" };
  try {
    const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
    const instruction = input.purpose === "product_specs"
      ? "استخرج فقط مواصفات منتج مرئية أو مكتوبة بوضوح. أعد JSON صالحاً يحوي brand, model, colors, sizes, capacities, material, warnings. ضع unknown عند عدم التأكد. لا تخترع مواصفات."
      : "اقرأ فاتورة مورد. أعد JSON صالحاً يحوي supplierName, invoiceNumber, invoiceDate, currency, lines[{name,quantity,unitCost,sku}], totals. لا تعتمد الفاتورة ولا تنشئ مخزوناً.";
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model, temperature: 0, max_tokens: 1500, messages: [{ role: "user", content: [{ type: "text", text: instruction }, { type: "image_url", image_url: { url: input.imageUrl } }] }] }) });
    const payload = await response.json(); const text = payload?.choices?.[0]?.message?.content;
    if (!response.ok || typeof text !== "string") return { available: false, provider: "openai", text: "تعذر تحليل الملف بصرياً.", structured: null, reason: "vision_provider_failed" };
    let structured: Record<string, unknown> | null = null; try { structured = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim()); } catch { /* Keep raw text for human review. */ }
    return { available: true, provider: "openai", text, structured };
  } catch { return { available: false, provider: "openai", text: "تعذر الاتصال بمزود Vision.", structured: null, reason: "vision_network_error" }; }
}
