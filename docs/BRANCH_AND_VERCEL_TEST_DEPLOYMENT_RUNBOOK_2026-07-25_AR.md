# Runbook: من ZIP إلى Vercel Test/Staging ناجح

**تاريخ الفحص:** 25 يوليو 2026  
**النطاق:** نشر تجربة/Staging فقط. ليس Production deployment.

## نتيجة فحص الحزمة

تم التحقق من:

```text
ZIP SHA-256                        ✅
ZIP extraction from a clean temp directory ✅
Release package manifest            ✅
Update channel manifest             ✅
check:paths                         ✅
check:import-case                   ✅
client/server boundary               ✅ 197 entries
lint                                ✅
typecheck                           ✅
unit tests                          ✅ 77 files / 214 tests
migration journal                   ✅ 89 SQL / 89 journal entries
Drizzle schema check                ✅
security verification               ✅
npm audit --audit-level=high        ✅ 0 vulnerabilities
git diff --check                    ✅
```

لم يتم تنفيذ GitHub CI أو Vercel build أو migration على قاعدة حية في هذا الفحص. هذه تبقى بوابات خارجية لازمة.

---

# القسم A — إعداد الكمبيوتر مرة واحدة

## A1. الملفات المطلوبة

من مجلد التسليم استخدم فقط:

```text
MallOS-Update-2026-07-25.zip
MallOS-Update-2026-07-25-CHECKSUM.txt
```

ضعهما في Downloads.

## A2. تحقق يدوي من البصمة في Windows PowerShell

```powershell
cd $HOME\Downloads
(Get-FileHash .\MallOS-Update-2026-07-25.zip -Algorithm SHA256).Hash
Get-Content .\MallOS-Update-2026-07-25-CHECKSUM.txt
```

يجب أن تتطابق البصمتان. إذا لم تتطابقا، أوقف العملية وأعد تنزيل الحزمة.

## A3. فك المصدر مرة واحدة

فك ZIP في مسار ثابت، مثلاً:

```text
C:\MallOS\salahsentar22
```

لا تفك ZIP جديد فوق المشروع يدوياً في التحديثات اللاحقة؛ ستستخدم updater.

## A4. المتطلبات

ثبت:

```text
Git for Windows
Node.js 22.19.0
```

ثم من PowerShell:

```powershell
node -v
git --version
```

يجب أن يبدأ Node بـ:

```text
v22.19
```

## A5. إعداد Git مرة واحدة

داخل المشروع:

```powershell
cd C:\MallOS\salahsentar22
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## A6. إنشاء قناة staging

Double Click:

```text
tools\Initialize-Mall-Update-Channel.cmd
```

عند الطلب اكتب:

```text
INITIALIZE_STAGING_UPDATE_CHANNEL
```

ثم أدخل رابط GitHub repository فقط، مثل:

```text
https://github.com/OWNER/REPOSITORY.git
```

النتيجة:

```text
Git branch: staging
Git push: origin/staging فقط
لا main
لا Production
```

---

# القسم B — كل تحديث مستقبلي

1. ضع ZIP و`.sha256` الجديدين معاً في Downloads.
2. افتح النسخة المحلية الموجودة مسبقاً:

```text
C:\MallOS\salahsentar22
```

3. Double Click:

```text
tools\Apply-Mall-Update.cmd
```

4. ألصق مسار ZIP.
5. عند السؤال بعد نجاح الفحص اكتب:

```text
Y
```

الأداة تتحقق من البصمة، تنشئ backup branch، تشغل الفحوصات، ثم تدفع staging فقط.

لا تشغل migrations أو Vercel Production أو تغير `.env` بنفسها.

---

# القسم C — تجهيز قاعدة Test/Staging

## C1. قاعدة واحدة فقط للتجربة

استخدم قاعدة اختبار مقصودة فقط. لا تستخدم قاعدة Production.

المسار الموصى به:

```text
Neon Staging direct URL   → migrations من الكمبيوتر أو GitHub Actions
Neon Staging pooled URL   → Vercel runtime
Render الجديدة            → Recovery only لاحقاً، لا توضع في Vercel DATABASE_URL
```

## C2. تطبيق migrations على قاعدة الاختبار

أنشئ `.env` محلياً فقط:

```powershell
Copy-Item .env.example .env
notepad .env
```

ضع رابط قاعدة الاختبار المباشر في:

```env
DATABASE_URL=<TEST DATABASE DIRECT URL>
APP_ENV=development
NEXT_PUBLIC_APP_ENV=development
REDIS_REQUIRED=false
PRODUCTION_LAUNCH_MODE=false
```

لا تضع URL في Git أو المحادثة.

ثم:

```powershell
npm ci
npm run db:migrate
npm run db:seed
```

لا تستخدم:

```powershell
npm run db:push
```

## C3. إنشاء أول أدمن Test

أضف مؤقتاً إلى `.env` المحلي:

```env
ALLOW_ADMIN_BOOTSTRAP=true
ADMIN_EMAIL=<your-admin-email>
ADMIN_NAME=<your-admin-name>
ADMIN_PASSWORD=<unique-16-plus-character-password>
```

ثم:

```powershell
npm run admin:bootstrap
```

بعد النجاح احذف أو عطل هذه القيم:

```env
ALLOW_ADMIN_BOOTSTRAP=false
```

## C4. إنشاء متجر اختبار حقيقي اختياري

بعد migrations وseed فقط:

```env
TEST_EXPERIENCE_CONFIRM=CREATE_TEST_EXPERIENCE
TEST_EXPERIENCE_MERCHANT_EMAIL=<test-merchant-email>
TEST_EXPERIENCE_MERCHANT_NAME=<test-merchant-name>
TEST_EXPERIENCE_MERCHANT_PASSWORD=<unique-16-plus-character-password>
TEST_EXPERIENCE_STORE_SLUG=test-experience-store
TEST_EXPERIENCE_WING_SLUG=test-experience-wing
```

ثم:

```powershell
npm run test:experience:bootstrap
```

المنتج الناتج يبقى:

```text
status=draft
price=0
stock=0
```

---

# القسم D — Vercel Test/Staging Project

## D1. أنشئ مشروع Vercel منفصل

أنشئ مشروعاً باسم قريب من:

```text
mall-os-staging
```

واربطه بنفس GitHub repository.

في Git settings:

```text
Production Branch = staging
```

هنا كلمة Production في Vercel تعني الفرع الرئيسي لمشروع **Staging** فقط، وليست إطلاقاً تجارياً حقيقياً.

## D2. إعدادات البناء

```text
Node.js Version: 22.19.0
Install Command: npm ci
Build Command: npm run build
```

## D3. متغيرات Vercel الضرورية للتجربة الأولى

أضف هذه المتغيرات في Vercel Project `mall-os-staging` ضمن Production scope لهذا المشروع فقط:

```env
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://<your-staging-vercel-domain>

JWT_SECRET=<unique-staging-secret-32-plus-characters>
SESSION_COOKIE_NAME=mall_staging_session
CRON_SECRET=<unique-staging-cron-secret>

DATABASE_URL=<TEST DATABASE RUNTIME URL>
DATABASE_POOLER_ENABLED=true
DB_POOL_MAX=3
POSTGRES_POOL_MAX=3
DB_IDLE_TIMEOUT_SECONDS=20
DB_CONNECT_TIMEOUT_SECONDS=10
DB_APPLICATION_NAME=salahsentar22-staging
HOME_DATA_TIMEOUT_MS=5000

# Temporary simple test mode; turn true only after isolated Redis/R2 are configured.
ENVIRONMENT_ISOLATION_ENFORCED=false
RUNTIME_ENVIRONMENT=staging
RESOURCE_NAMESPACE=mall-os:staging
REDIS_KEY_PREFIX=mall-os:staging:

REDIS_REQUIRED=false
MEDIA_PROVIDER=local
PRIVATE_DOCUMENTS_STORAGE_PROVIDER=local
BACKUP_STORAGE_PROVIDER=local

EMAIL_NOTIFICATIONS_ENABLED=false
SMS_NOTIFICATIONS_ENABLED=false
SMS_WEBHOOK_ENABLED=false
OUTBOUND_DELIVERY_MODE=disabled

PAYMENT_ENVIRONMENT=sandbox
ERP_ENVIRONMENT=sandbox
PLATFORM_CUSTOMER_MONEY_MODE=merchant_collects
PRODUCTION_LAUNCH_MODE=false
```

### Database URL rule

إذا كانت قاعدة Staging في Neon:

```text
Vercel DATABASE_URL = Neon pooled URL
Local migration DATABASE_URL = Neon direct/unpooled URL
```

إذا كنت تستخدم قاعدة Test Render مؤقتة فقط، استخدم رابطها الخارجي مع SSL في Vercel، واضبط:

```env
DATABASE_POOLER_ENABLED=false
DB_POOL_MAX=3
```

لكن لا تستخدم Render Recovery database لاحقاً في Vercel runtime.

## D4. متغيرات لا تضفها الآن إلا عند تفعيل الخدمة

اتركها غير مضبوطة أو فارغة في تجربة بسيطة:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CLOUDINARY_*
S3_*
PRIVATE_DOCUMENTS_R2_*
BACKUP_S3_*
STRIPE_*
LOCAL_GATEWAY_*
INTEGRATION_*
GOOGLE_*
SENTRY_*
EMAIL_WEBHOOK_*
SMS_WEBHOOK_*
```

---

# القسم E — أول نشر واختبار

1. بعد Push إلى `staging`، انتظر:

```text
GitHub Actions → CI = success
Security Pipeline = success
```

2. افتح Vercel `mall-os-staging` وتأكد أن Build نجح.
3. افتح:

```text
https://<your-staging-vercel-domain>/api/health?deep=1
```

النتيجة المطلوبة:

```json
"database": { "ok": true }
"schema": { "ok": true, "state": "ready" }
```

4. ثم اختبر:

```text
/
/login
/register
/offers
/wings
/admin
```

5. لا تعتبر `store not found` خللاً في الكود إذا لم تنشئ متجر اختبار بعد. استخدم `test:experience:bootstrap` عند الحاجة.

---

# القسم F — متى تتوقف؟

| الحالة | الإجراء |
|---|---|
| CI فشل | لا تغير Vercel أو DB؛ أصلح رسالة CI أولاً. |
| Vercel Build فشل | لا تشغل migrations؛ راجع Build Log فقط. |
| Health deep schema_incomplete | طبق `npm run db:migrate` على قاعدة الاختبار الصحيحة. |
| `background_jobs does not exist` | migrations ناقصة؛ لا تنشئ الجدول يدوياً. |
| Health ready لكن لا توجد متاجر | شغل Test Experience Bootstrap أو أضف بيانات من الواجهة. |
| Vercel runtime timeout | راجع DATABASE_URL/SSL/Pool، لا تبدل DB عشوائياً. |

---

# ممنوعات

```text
لا ترفع .env إلى GitHub
لا تضع DATABASE_URL في المحادثة
لا تستخدم db:push في Staging/Production
لا تستخدم db:seed في Production
لا تربط Render Recovery DB بـ Vercel
لا تدمج staging إلى main في مرحلة التجربة
لا تستخدم Vercel Production لمشروع تجاري حقيقي الآن
```

## بوابة النجاح

تعتبر تجربة Vercel ناجحة فقط عند:

```text
ZIP checksum verified
→ staging push success
→ GitHub CI green
→ Vercel build green
→ /api/health?deep=1 returns database ok + schema ready
→ login/admin/public pages open
```
