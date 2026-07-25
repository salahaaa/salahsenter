/**
 * Adapter boundary for Arabic-capable PDF rendering. Use a managed renderer in
 * production so PDF/font/chromium weight never inflates Next serverless bundles.
 */
export async function renderReportPdf(input: { title: string; snapshot: Record<string, unknown> }) {
  const endpoint = process.env.PDF_RENDER_WEBHOOK_URL;
  if (!endpoint) throw new Error("خدمة PDF غير مهيأة. اضبط PDF_RENDER_WEBHOOK_URL قبل جدولة تقارير PDF.");
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.PDF_RENDER_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.PDF_RENDER_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ title: input.title, direction: "rtl", locale: "ar", snapshot: input.snapshot }) });
  if (!response.ok) throw new Error(`فشلت خدمة PDF بحالة ${response.status}`);
  const payload = await response.json().catch(() => ({})) as { url?: string };
  if (!payload.url || !/^https:\/\//.test(payload.url)) throw new Error("خدمة PDF لم تعد رابطاً آمناً للملف");
  return payload.url;
}
