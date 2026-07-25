import { ForgotStoreCredentialsForm } from "@/components/auth/forgot-store-credentials-form";
import { AuthShell } from "@/components/layout/auth-shell";

export default function ForgotStoreCredentialsPage() {
  return (
    <AuthShell
      title="استعادة بيانات المتجر"
      description="أدخل البريد الإلكتروني المعتمد أو رقم المتجر. لا نعرض البيانات على الشاشة قبل التحقق؛ ترسل إلى جهة التواصل المعتمدة."
      backHref="/login"
      backLabel="العودة لتسجيل الدخول"
      sideDescription="يمكنك استعادة رقم المتجر وطلب رابط تعيين كلمة مرور جديد بأمان."
    >
      <ForgotStoreCredentialsForm />
    </AuthShell>
  );
}
