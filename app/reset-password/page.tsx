import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/layout/auth-shell";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="تعيين كلمة مرور جديدة" description="اختر كلمة مرور قوية لحماية حسابك ومتجرك وطلباتك." backHref="/login" backLabel="العودة لتسجيل الدخول" sideDescription="نظام الجلسات والتنبيهات يحافظ على أمان دخولك ويمنحك تجربة مستقرة داخل المنصة.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
