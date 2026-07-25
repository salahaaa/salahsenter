import Link from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <AuthShell title="إنشاء حساب" description="يلزم إنشاء حساب قبل طلب فتح متجر حتى تصلك تنبيهات العقد والمراجعة وبيانات الدخول." sideDescription="أنشئ حسابك مرة واحدة واستخدمه كعميل أو كتاجر عند اعتماد متجرك داخل المنصة.">
      <Suspense>
        <RegisterForm />
      </Suspense>
      <div className="mt-4 text-center">
        <Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button>
      </div>
    </AuthShell>
  );
}
