export type ApplicationSummaryInput = {
  storeName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string | null;
  businessActivity: string;
  description?: string | null;
  status: string;
  wingName?: string | null;
  location?: string;
  documentsCount: number;
  hasSignature: boolean;
  contractAcceptedAt?: Date | string | null;
};

export function summarizeMerchantApplication(input: ApplicationSummaryInput) {
  const missing: string[] = [];
  if (!input.applicantPhone) missing.push("رقم هاتف مقدم الطلب");
  if (!input.wingName) missing.push("الجناح/النشاط المناسب");
  if (!input.location) missing.push("الموقع الجغرافي");
  if (!input.description || input.description.length < 20) missing.push("وصف نشاط أوضح");
  if (!input.documentsCount) missing.push("المستندات الداعمة");
  if (["contract_created", "contract_signed", "waiting_final_approval"].includes(input.status) && !input.hasSignature) missing.push("التوقيع الإلكتروني");

  const readiness = Math.max(0, Math.min(100,
    35 +
    (input.applicantPhone ? 10 : 0) +
    (input.wingName ? 10 : 0) +
    (input.location ? 10 : 0) +
    (input.description && input.description.length >= 20 ? 10 : 0) +
    Math.min(15, input.documentsCount * 5) +
    (input.hasSignature ? 10 : 0)
  ));

  const recommendedAction = readiness >= 85 && input.hasSignature
    ? "مناسب للموافقة النهائية بعد مراجعة المستندات يدوياً."
    : readiness >= 70
      ? "مناسب للاستكمال أو القبول المبدئي مع طلب النواقص البسيطة."
      : "يحتاج استكمال بيانات أو مستندات قبل الاعتماد.";

  const risks = [
    ...(!input.documentsCount ? ["لا توجد مستندات مرفقة؛ مخاطرة اعتماد غير موثق."] : []),
    ...(!input.location ? ["الموقع غير مكتمل؛ قد يؤثر على التغطية والشحن."] : []),
    ...(input.status === "waiting_final_approval" && !input.hasSignature ? ["الطلب بانتظار موافقة نهائية لكن لا يوجد توقيع ظاهر."] : [])
  ];

  return {
    readiness,
    summary: `طلب فتح متجر (${input.storeName}) مقدم من ${input.applicantName}. النشاط: ${input.businessActivity}${input.wingName ? ` ضمن ${input.wingName}` : ""}. الحالة الحالية: ${input.status}.`,
    missing,
    risks,
    recommendedAction,
    checklist: [
      { label: "بيانات مقدم الطلب", ok: Boolean(input.applicantName && input.applicantEmail && input.applicantPhone) },
      { label: "النشاط والجناح", ok: Boolean(input.businessActivity && input.wingName) },
      { label: "الموقع", ok: Boolean(input.location) },
      { label: "المستندات", ok: input.documentsCount > 0 },
      { label: "التوقيع", ok: input.hasSignature || !["contract_created", "contract_signed", "waiting_final_approval"].includes(input.status) }
    ]
  };
}

export type AdReviewInput = {
  name: string;
  type: string;
  status: string;
  storeName: string;
  budget?: string | number | null;
  dailyBudget?: string | number | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  creative?: Record<string, unknown> | null;
};

function hasUrl(value: unknown) {
  return typeof value === "string" && (value.startsWith("/") || /^https?:\/\//.test(value));
}

export function reviewMerchantAd(input: AdReviewInput) {
  const creative = input.creative || {};
  const imageUrl = creative.imageUrl;
  const headline = String(creative.headline || input.name || "").trim();
  const description = String(creative.description || "").trim();
  const linkUrl = creative.linkUrl;
  const aiDesign = creative.aiDesign && typeof creative.aiDesign === "object" && !Array.isArray(creative.aiDesign) ? creative.aiDesign as Record<string, unknown> : null;
  const warnings: string[] = [];
  const strengths: string[] = [];

  if (aiDesign?.conceptId && aiDesign?.visualPrompt) strengths.push("تم حفظ اتجاه تصميمي مولد بالذكاء مع prompt قابل للمراجعة.");
  if (input.type === "homepage_banner" && !hasUrl(imageUrl)) warnings.push("إعلان البنر الرئيسي يحتاج صورة واضحة قبل النشر في الواجهة.");
  else strengths.push("الصورة/المادة الإعلانية متوفرة.");
  if (headline.length < 8) warnings.push("عنوان الإعلان قصير؛ يفضل عنوان أوضح للمتسوق.");
  else strengths.push("العنوان واضح مبدئياً.");
  if (description.length < 20) warnings.push("الوصف قصير؛ يفضل توضيح العرض أو الميزة.");
  if (linkUrl && !hasUrl(linkUrl)) warnings.push("رابط الإعلان غير واضح أو غير صالح.");
  if (Number(input.budget || 0) <= 0) warnings.push("الميزانية غير محددة أو صفرية.");
  if (input.startsAt && input.endsAt && new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) warnings.push("تاريخ نهاية الإعلان قبل أو يساوي تاريخ البداية.");

  const score = Math.max(0, Math.min(100, 55 + strengths.length * 10 - warnings.length * 12 + (Number(input.budget || 0) > 0 ? 10 : 0)));
  const recommendation = score >= 80 && !warnings.some((item) => item.includes("صورة"))
    ? "مناسب للاعتماد والنشر."
    : score >= 60
      ? "يمكن اعتماده بعد معالجة الملاحظات."
      : "يفضل إرجاعه للتاجر للتعديل قبل الاعتماد.";

  return {
    score,
    summary: `إعلان ${input.name} من متجر ${input.storeName} بنوع ${input.type}.`,
    strengths,
    warnings,
    recommendation,
    publishReady: score >= 80 && !warnings.some((item) => item.includes("صورة") || item.includes("تاريخ"))
  };
}
