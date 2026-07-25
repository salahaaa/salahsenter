// Shared application-flow helpers — safe to import from BOTH Server and Client Components.
// NOTE: This file must NOT have a "use client" directive, otherwise Server Components
// that call nextApplicationHint()/statusLabels would throw a "Digest" render error.

export type ApplicationStatus =
  | "new"
  | "pending"
  | "under_review"
  | "waiting_for_data"
  | "documents_required"
  | "pre_approved"
  | "contract_created"
  | "contract_signed"
  | "waiting_final_approval"
  | "approved"
  | "active"
  | "rejected";

export const statusLabels: Record<ApplicationStatus, string> = {
  new: "جديد",
  pending: "قيد التقديم",
  under_review: "قيد المراجعة",
  waiting_for_data: "بانتظار تعديل البيانات",
  documents_required: "مطلوب مستندات",
  pre_approved: "قبول مبدئي",
  contract_created: "العقد جاهز للتوقيع",
  contract_signed: "تم توقيع العقد",
  waiting_final_approval: "بانتظار الموافقة النهائية",
  approved: "معتمد",
  active: "مفعل",
  rejected: "مرفوض"
};

export function nextApplicationHint(status: string) {
  switch (status) {
    case "new":
    case "pending":
      return "طلبك وصل إلى الإدارة، وسيبدأ فريق المراجعة بفحص البيانات.";
    case "under_review":
      return "الطلب قيد المراجعة. تابع التنبيهات لأي طلب مستندات أو تعديل.";
    case "documents_required":
      return "الإدارة طلبت مستندات إضافية. ارفع المطلوب من صفحة المتابعة أو تواصل مع الإدارة.";
    case "waiting_for_data":
      return "الإدارة طلبت تعديل بيانات. راجع ملاحظة الإدارة ثم أرسل التعديل.";
    case "pre_approved":
      return "تم قبول الطلب مبدئياً. الخطوة التالية أن ترسل الإدارة العقد للتوقيع.";
    case "contract_created":
      return "العقد جاهز الآن. افتح صفحة العقد ووقّعه إلكترونياً.";
    case "contract_signed":
    case "waiting_final_approval":
      return "تم حفظ توقيعك. الطلب ينتظر الموافقة النهائية من الأدمن لتفعيل المتجر.";
    case "approved":
    case "active":
      return "تم تفعيل المتجر. يمكنك الدخول إلى لوحة التاجر واستكمال الإعدادات.";
    case "rejected":
      return "تم رفض الطلب. يمكنك مراجعة ملاحظة الإدارة ثم تقديم طلب جديد عند معالجة السبب.";
    default:
      return "تابع حالة الطلب والتنبيهات من حسابك.";
  }
}
