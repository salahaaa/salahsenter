import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthShell } from "@/components/layout/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="استعادة كلمة المرور" description="أدخل بريدك أو رقم المتجر ليتم إنشاء رابط استعادة آمن." backHref="/login" backLabel="العودة لتسجيل الدخول" sideDescription="استعادة آمنة تساعد التاجر والعميل على الرجوع للحساب دون فقدان بيانات المتجر أو الطلبات.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
