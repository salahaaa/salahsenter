# إنشاء أول أدمن من GitHub Actions عبر الهاتف

**التاريخ:** 2026-07-20  
**الهدف:** إنشاء أول `super_admin` دون تشغيل PowerShell محلياً، بعد رفع المصدر الحالي إلى GitHub.

## متى تستخدمه؟

استخدم Workflow فقط عندما:

- لا تعرف بريد أدمن موجود، أو لا يوجد أدمن نشط.
- قاعدة Neon المقصودة هي القاعدة نفسها التي سيستخدمها Vercel.
- تريد إنشاء أول مالك للمنصة بطريقة موثقة.

لا تستخدمه لتغيير كلمة مرور أدمن موجود. إذا كان يوجد `super_admin` نشط، يفشل السكربت عمداً ولا يكتب فوقه.

## Workflow

الملف:

```text
.github/workflows/bootstrap-first-admin.yml
```

ينفذ بالترتيب:

```text
npm ci
→ migrations:verify
→ drizzle-kit check
→ db:migrate
→ admin:bootstrap
```

ولا يبدأ إلا عند كتابة التأكيد:

```text
BOOTSTRAP_FIRST_ADMIN
```

## إعداد Secrets من GitHub عبر الهاتف

بعد رفع المصدر إلى GitHub، افتح GitHub من متصفح الهاتف بوضع سطح المكتب:

```text
Repository
→ Settings
→ Environments
→ production
→ Environment secrets
```

أنشئ هذه الأسرار الأربعة. لا تضعها في Variables العامة أو source:

| الاسم | القيمة |
|---|---|
| `DATABASE_URL` | Neon **Direct / Unpooled** Connection String للقاعدة المقصودة |
| `ADMIN_BOOTSTRAP_EMAIL` | بريد المالك الذي تختاره |
| `ADMIN_BOOTSTRAP_NAME` | اسم المالك |
| `ADMIN_BOOTSTRAP_PASSWORD` | كلمة مرور خاصة، 16 حرفاً على الأقل، وليست تجريبية |

لا تضع `DATABASE_URL` pooled في GitHub workflow migrations/Bootstrap. الرابط pooled خاص بـVercel Runtime.

إذا كانت بيئة GitHub `production` فيها Required reviewers، أزلها مؤقتاً إذا كنت لا تريد موافقة ثانية؛ Workflow نفسه لا يتطلب موافقة ثانية.

## التشغيل من الهاتف

اذهب إلى:

```text
GitHub Repository
→ Actions
→ Bootstrap first platform administrator
→ Run workflow
```

في خانة confirmation اكتب حرفياً:

```text
BOOTSTRAP_FIRST_ADMIN
```

ثم اضغط:

```text
Run workflow
```

## النتيجة المطلوبة

في آخر Logs يجب أن ترى:

```text
ADMIN_BOOTSTRAP_COMPLETED
```

بعدها افتح الموقع:

```text
/login
```

وسجل الدخول بالبريد وكلمة المرور اللذين حفظتهما في Secrets.

في أول دخول سيحولك النظام إلى:

```text
/account/security?mustChangePassword=1
```

غيّر كلمة المرور، ثم سجل الدخول مرة أخرى، وبعدها افتح:

```text
/admin
```

## الحماية

- Workflow لا يأخذ كلمة المرور في inputs أو logs.
- Bootstrap يرفض كلمة مرور أقل من 16 حرفاً.
- Bootstrap يرفض التشغيل إذا وجد `super_admin` نشط.
- لا يعرض GitHub Secrets بعد حفظها.
- لا ترسل الأسرار أو صورها في المحادثة.
