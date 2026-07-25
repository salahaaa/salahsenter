# إنشاء أول أدمن ومسار أمان الحساب

**التاريخ:** 2026-07-20

## الحالة

لا توجد كلمات مرور أو حسابات أدمن افتراضية داخل المصدر. هذا مقصود؛ كلمات المرور تحفظ كـbcrypt hashes ولا يمكن استعادتها من Neon أو الكود.

عند عدم معرفة بريد الأدمن أو عدم وجوده، المسار الصحيح هو Bootstrap محكوم يعمل مرة واحدة فقط.

## إصلاح مسار أول دخول

كان Bootstrap ينشئ أول `super_admin` مع:

```text
mustChangePassword=true
```

لكن واجهة الدخول كانت توجّه أي حساب يجب عليه تغيير كلمة المرور إلى إعدادات تاجر. الأدمن لا يملك بالضرورة متجراً، لذلك أضيفت صفحة عامة لكل الحسابات:

```text
/account/security?mustChangePassword=1
```

وتحتوي نموذج تغيير كلمة المرور. بعد تغييرها:

- تزال علامة `mustChangePassword`.
- تنتهي كل الجلسات.
- يدخل الأدمن بكلمة المرور الجديدة ثم يفتح `/admin`.

## Bootstrap الآمن

الملف:

```text
scripts/bootstrap-admin.ts
```

يرفض التنفيذ إذا:

- لم تكن `ALLOW_ADMIN_BOOTSTRAP=true`.
- كانت كلمة المرور أقل من 16 حرفاً أو تبدو تجريبية.
- لم يكن دور `super_admin` موجوداً؛ أي لم تطبق migrations.
- كان يوجد `super_admin` نشط بالفعل.
- كان البريد المختار مستخدماً من حساب قائم.

لا يقوم بالكتابة فوق أي أدمن موجود.

## خطوات التنفيذ على جهاز موثوق

1. رفع المصدر الحالي وتطبيق migrations على Neon أولاً.
2. داخل مجلد المصدر، اضبط محلياً فقط:

```powershell
$env:DATABASE_URL = "Neon Direct / Unpooled URL"
$env:ADMIN_EMAIL = "your-private-admin-email@example.com"
$env:ADMIN_NAME = "اسم مالك المنصة"
$env:ADMIN_PASSWORD = "كلمة مرور خاصة من 16 حرفاً على الأقل"
$env:ALLOW_ADMIN_BOOTSTRAP = "true"
```

3. نفذ:

```powershell
npm run admin:bootstrap
```

4. النتيجة الآمنة المطلوبة:

```text
ADMIN_BOOTSTRAP_COMPLETED
```

5. احذف متغيرات الجلسة:

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_NAME
Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:ALLOW_ADMIN_BOOTSTRAP
```

6. افتح `/login` وسجل الدخول بالبريد وكلمة المرور اللذين اخترتهما. سيطلب النظام تغيير كلمة المرور في `/account/security` ثم سجل الدخول مجدداً وافتح `/admin`.

لا تضع الرابط أو كلمة المرور في GitHub أو Vercel variables الدائمة أو المحادثة.

## التحقق

- Bootstrap access test أضيف.
- lint/typecheck/tests/migrations/security/audit اجتازت في المصدر الحالي.
