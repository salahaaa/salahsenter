import crypto from "node:crypto";
import type { MerchantApplication } from "@/lib/db";

function revenueModelLabel(model: string) {
  if (model === "sales_commission") return "عمولة مبيعات فقط";
  if (model === "hybrid") return "إيجار شهري + عمولة مبيعات";
  return "إيجار شهري فقط";
}

export function buildDefaultContract(application: Pick<MerchantApplication, "storeName" | "applicantName" | "businessActivity" | "applicantEmail" | "revenueModel" | "monthlyRent" | "commissionRate" | "dueDays" | "graceDays">) {
  return `عقد فتح متجر إلكتروني داخل منصة Yemeni Trade Center

الطرف الأول: إدارة منصة Yemeni Trade Center.
الطرف الثاني: ${application.applicantName}، صاحب طلب فتح متجر باسم: ${application.storeName}.
النشاط التجاري: ${application.businessActivity}.
البريد المعتمد للتواصل: ${application.applicantEmail}.

نموذج إيراد المنصة: ${revenueModelLabel(application.revenueModel)}.
الإيجار الشهري: ${application.monthlyRent} ريال.
نسبة العمولة: ${application.commissionRate}% من تقرير مبيعات معتمد عند انطباق النموذج.
أيام الاستحقاق: ${application.dueDays}.
أيام السماح: ${application.graceDays}.
رسوم الإعلانات والظهور المميز تخضع لاتفاق ترويج مستقل ولا تعد جزءاً من هذا العقد إلا إذا نص ملحق مستقل على ذلك.

بنود العقد:
1. يلتزم الطرف الثاني بصحة جميع البيانات والوثائق المقدمة في طلب فتح المتجر.
2. يلتزم الطرف الثاني بإدارة منتجاته وأسعاره ومخزونه وطلباته بما لا يخالف الأنظمة والسياسات المعتمدة في المنصة.
3. يدفع العميل للتاجر مباشرة عبر وسيلة الدفع الخاصة بالتاجر. لا تحتفظ المنصة بأموال مبيعات العملاء ولا تعمل كوسيط مالي لها.
4. يحق لإدارة المنصة مراجعة المتجر أو تعطيله عند وجود مخالفات أو بيانات غير صحيحة أو تأخر مستحقات المنصة بعد المهلة التعاقدية.
5. لا يتم النشر العام للمتجر إلا بعد توقيع هذا العقد، الموافقة النهائية، وإتمام checklist الجاهزية التشغيلية.
6. رقم المتجر الممنوح بعد التفعيل رقم فريد وغير قابل للتعديل من قبل التاجر.
7. اسم المتجر لا يعدل إلا من خلال الأدمن ووفق الصلاحيات المحددة.
8. يعد التوقيع الإلكتروني داخل مربع التوقيع موافقة على هذه النسخة تحديداً من العقد.

إقرار:
أقر أنا مقدم الطلب بأنني قرأت العقد كاملاً ووافقت على جميع البنود، وأتحمل المسؤولية عن صحة البيانات والوثائق والمرفقات.`;
}

export function contractBodyHash(body: string) {
  return crypto.createHash("sha256").update(body, "utf8").digest("hex");
}
