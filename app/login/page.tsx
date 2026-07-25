import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <AuthShell title="تسجيل الدخول" description="ادخل إلى حسابك بأمان للوصول إلى لوحة الأدمن أو التاجر أو متابعة طلباتك." sideDescription="بوابة دخول احترافية محمية بجلسات آمنة وتنبيهات فورية وتجربة استخدام سلسة.">
      <Suspense>
        <LoginForm />
      </Suspense>
      <Button asChild variant="outline" className="mt-4 w-full">
        <Link href="/apply-store">طلب فتح متجر جديد</Link>
      </Button>
    </AuthShell>
  );
}
