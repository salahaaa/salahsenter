# رفع التحديثات إلى GitHub وتجهيز متغيرات البيئة — خطوة بخطوة

**التاريخ:** 2026-07-16  
**الفرع المحلي:** `main`  
**مهم:** لا يحتوي المستودع المحلي حالياً على remote باسم `origin`؛ يجب إضافته قبل أول push.

## 1. أي مجلد تستخدم؟

استخدم المجلد الأصلي الحالي فقط:

```text
/home/user/salahsentar22
```

أو، إن كنت نقلت الحزمة إلى جهاز آخر، فك ضغط:

```text
salahsentar22-upload-source-light.zip
```

ثم ادخل إلى المجلد الذي يحتوي مباشرة على:

```text
package.json
app/
components/
lib/
drizzle/
```

لا ترفع مجلد `Yemeni Trade Center` لأنه حزمة قديمة ولا يمثل آخر التحديثات.

## 2. ما الذي لا يرفع إلى GitHub؟

لا ترفع أو تضف إلى Git:

```text
node_modules/
.next/
coverage/
.cache/
build/
dist/
out/
.env
.env.local
.env.production
```

الحزمة الخفيفة استبعدت هذه الملفات تلقائياً.

## 3. المتطلبات المحلية

```bash
node --version   # يجب أن يكون 20 أو 22
npm --version    # يفضل 10+
```

ثم:

```bash
cd /path/to/salahsentar22
npm ci
```

## 4. فحص قبل الرفع

```bash
npm run check:paths
npm run lint
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck
npm test
npm run migrations:verify
npx drizzle-kit check --config=drizzle.config.ts
npm run security:verify
git diff --check
```

لا تشغل `npm run db:seed` على قاعدة Production.

## 5. ربط المشروع بمستودع GitHub

رابط المستودع المعتمد:

```text
https://github.com/salahaaa/salahsentar22.git
```

نفذ مرة واحدة داخل مجلد المشروع:

```bash
git remote add origin https://github.com/salahaaa/salahsentar22.git
```

إذا ظهر أن `origin` موجود مسبقاً، استخدم بدلاً من ذلك:

```bash
git remote set-url origin https://github.com/salahaaa/salahsentar22.git
```

ثم تحقق:

```bash
git remote -v
git fetch origin --prune
git branch -vv
```

## 6. الرفع الآمن الموصى به: Branch ثم Pull Request

هذا المسار لا يغير `main` مباشرة:

```bash
git switch -c upload/updates-2026-07-16
git add -A
git diff --cached --check
git commit -m "feat: complete marketplace updates and operational improvements"
git push -u origin upload/updates-2026-07-16
```

بعدها افتح GitHub ثم:

```text
Pull requests
→ New pull request
→ base: main
→ compare: upload/updates-2026-07-16
→ Create pull request
→ انتظر GitHub Actions
→ Merge بعد نجاحها
```

## 7. بديل: الرفع المباشر إلى main

استخدمه فقط إن كنت متأكداً أنه لا يوجد عمل آخر في GitHub:

```bash
git switch main
git add -A
git diff --cached --check
git commit -m "feat: complete marketplace updates and operational improvements"
git fetch origin --prune
git rebase origin/main
git push -u origin main
```

### في حال ظهور conflict أثناء rebase

```bash
git status
# عدّل الملفات المتعارضة يدوياً
git add <file>
git rebase --continue
```

ولإلغاء rebase والعودة للحالة السابقة:

```bash
git rebase --abort
```

## 8. مصادقة GitHub

لا تضع token في الكود أو ملف `.env` أو رابط remote.

الخيار الموصى به:

```bash
gh auth login
```

ثم اختر:

```text
GitHub.com
HTTPS
Login with a web browser
```

أو استخدم Git Credential Manager / Fine-grained Personal Access Token بصلاحية:

```text
Contents: Read and write
```

## 9. GitHub Actions وmigrations

بعد رفع الكود، أضف في GitHub:

```text
Repository → Settings → Environments → production → Secrets
```

المتغير المطلوب لتشغيل workflow migrations:

```text
DATABASE_URL
```

ثم من GitHub:

```text
Actions → Apply database migrations → Run workflow
```

لا تطبق migrations على Production قبل نسخة احتياطية واختبار Staging.

---

# متغيرات البيئة

## A. GitHub فقط

GitHub لا يحتاج متغيرات runtime لتخزين الكود.  
المطلوب فقط لتشغيل workflow migrations:

```env
DATABASE_URL=postgresql://...
```

ضعه GitHub Secret وليس في source.

## B. الحد الأدنى للتشغيل المحلي أو Staging

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
JWT_SECRET=قيمة_عشوائية_طويلة_بطول_32_بايت_على_الأقل
SESSION_COOKIE_NAME=mall_session
NEXT_PUBLIC_APP_URL=https://staging.example.com
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
PLATFORM_CUSTOMER_MONEY_MODE=merchant_collects
CRON_SECRET=قيمة_عشوائية_طويلة
MEDIA_PROVIDER=local
MEDIA_MAX_SIZE_MB=8
REDIS_REQUIRED=false
```

توليد أسرار محلياً:

```bash
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # CRON_SECRET
```

## C. متغيرات Production الأساسية

```env
DATABASE_URL=رابط_PostgreSQL_خارجي_ومؤمن_ssl
JWT_SECRET=قيمة_مختلفة_وقوية_عن_Staging
SESSION_COOKIE_NAME=mall_session
NEXT_PUBLIC_APP_URL=https://your-domain.example
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
PLATFORM_CUSTOMER_MONEY_MODE=merchant_collects

REDIS_REQUIRED=true
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

CRON_SECRET=قيمة_عشوائية_طويلة
JOBS_PROCESS_LIMIT=50
JOBS_LOOP_INTERVAL_MS=5000

DATABASE_POOLER_ENABLED=true
DB_POOL_MAX=3
POSTGRES_POOL_MAX=3
DB_IDLE_TIMEOUT_SECONDS=20
DB_CONNECT_TIMEOUT_SECONDS=10
DB_APPLICATION_NAME=salahsentar22-production

MEDIA_PROVIDER=cloudinary
MEDIA_MAX_SIZE_MB=8
NEXT_IMAGE_REMOTE_HOSTS=res.cloudinary.com
CSP_IMG_SRC=res.cloudinary.com
CSP_CONNECT_SRC=

PRODUCTION_LAUNCH_MODE=true
```

اختر **مزود وسائط واحداً** فقط:

### Cloudinary

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=marketplace
```

### أو S3 / R2

```env
S3_ENDPOINT=...
S3_REGION=auto
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://...
```

## D. النسخ الاحتياطي والمراقبة الموصى بها قبل الإطلاق العام

```env
BACKUP_STORAGE_PROVIDER=s3
BACKUP_S3_BUCKET=...
BACKUP_S3_ENDPOINT=...
BACKUP_S3_REGION=auto
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
BACKUP_S3_PREFIX=database
BACKUP_MEDIA_ENABLED=true
BACKUP_MEDIA_SOURCE_HOSTS=...
RECOVERY_TEST_DATABASE_URL=قاعدة_استعادة_منفصلة

SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_TRACES_SAMPLE_RATE=0.05
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05
UPTIME_WEBHOOK_URL=...
LOG_DRAIN_URL=...
METRICS_EXPORT_ENABLED=true
METRICS_TOKEN=قيمة_عشوائية_طويلة
```

## E. اختيارية: Google / رسائل / دفع / ERP / AI

لا تضفها إلا عندما تفعل الميزة فعلياً.

### Google OAuth

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain.example/api/auth/google/callback
```

### البريد والرسائل

```env
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_WEBHOOK_URL=...
EMAIL_WEBHOOK_TOKEN=...
SMS_NOTIFICATIONS_ENABLED=true
SMS_WEBHOOK_ENABLED=true
SMS_WEBHOOK_URL=...
SMS_WEBHOOK_TOKEN=...
WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_WEBHOOK_URL=...
WHATSAPP_WEBHOOK_TOKEN=...
```

### الدفع

```env
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
LOCAL_PAYMENT_WEBHOOK_SECRET=...
LOCAL_GATEWAY_API_URL=...
LOCAL_GATEWAY_REFUND_URL=...
LOCAL_GATEWAY_MERCHANT_ID=...
LOCAL_GATEWAY_WEBHOOK_SECRET=...
PAYMENT_PROVIDER_API_KEY=...
```

### تكامل ERP

يفضل إنشاء clients من لوحة التكامل، ولا تستخدم env fallback إلا في التهيئة الأولى:

```env
INTEGRATION_API_KEYS=
INTEGRATION_CLIENTS_JSON=
```

### AI خارجي

الافتراضي الآمن هو rules/provider-neutral. لا تضف مفتاحاً إلا عند تفعيل مزود فعلي:

```env
AI_PROVIDER=rules
OPENAI_API_KEY=...
OPENAI_MODEL=...
GEMINI_API_KEY=...
GEMINI_MODEL=...
```

### الإعلانات والتحليلات

```env
AD_IMPRESSION_FREQUENCY_CAP=3
SEARCH_ANALYTICS_SAMPLE_RATE=0.05
```

## 10. ترتيب النشر الصحيح

```text
1. ارفع الكود إلى GitHub.
2. انتظر نجاح CI.
3. أنشئ Staging واربط قاعدة Staging منفصلة.
4. أضف متغيرات Staging.
5. طبق migrations على Staging فقط.
6. اختبر المسارات الحرجة يدوياً وE2E.
7. جهز backup وRedis ووسائط ومراقبة Production.
8. أضف متغيرات Production في Vercel.
9. خذ backup ثم طبق migrations Production من workflow المقفل.
10. انشر Production وراقب السجلات والمقاييس.
```

لا تستخدم أبداً في Production:

```bash
npm run db:seed
npm run db:push
```
