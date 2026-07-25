# GitHub + Vercel Deployment Guide

## 1) تجهيز المستودع المحلي

```bash
git init
git add .
git commit -m "Initial enterprise marketplace"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

> لا ترفع ملف `.env` نهائياً. استخدم `.env.example` كمرجع فقط.

## 2) متغيرات البيئة المطلوبة في Vercel

أضف المتغيرات من Project Settings → Environment Variables:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
JWT_SECRET=ضع_قيمة_عشوائية_طويلة_جداً
SESSION_COOKIE_NAME=mall_session
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_IMAGE_REMOTE_HOSTS=res.cloudinary.com,your-cdn.example.com

MEDIA_PROVIDER=cloudinary # أو s3 أو r2 أو local للتجارب فقط
MEDIA_MAX_SIZE_MB=8

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=marketplace

S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=

EMAIL_NOTIFICATIONS_ENABLED=false
SMS_NOTIFICATIONS_ENABLED=false
```

## 3) قاعدة البيانات

أنشئ PostgreSQL على Render أو Neon أو Supabase أو Vercel Postgres، ثم نفذ محلياً أو من بيئة آمنة:

```bash
npm ci
npm run migrations:verify
npm run db:migrate
```

أو، في بيئة التطوير فقط:

```bash
npm run db:push
npm run db:seed
```

## 4) ربط Vercel بـ GitHub

1. ادخل Vercel.
2. New Project.
3. Import من GitHub.
4. اختر المستودع.
5. Framework: Next.js.
6. Build Command: `npm run build`.
7. Install Command: `npm ci`.
8. أضف Environment Variables.
9. Deploy.

## 5) فحص ما بعد النشر

- افتح `/api/health`.
- سجل دخول الأدمن.
- افتح `/admin`.
- نفذ دورة فتح متجر كاملة حسب `docs/ACCEPTANCE_TESTS.md`.
- تأكد من أن رفع الملفات يستخدم Cloudinary/S3/R2 وليس local في الإنتاج.

## 6) ملاحظات مهمة للإنتاج

- استخدم `MEDIA_PROVIDER=cloudinary` أو `s3`/`r2`، ولا تعتمد على `local` في Vercel لأن نظام الملفات مؤقت.
- اضبط `NEXT_IMAGE_REMOTE_HOSTS` ولا تستخدم wildcard.
- لا تنفذ `db:push` على production إلا إذا كنت مدركاً للمخاطر؛ استخدم migrations.
- شغّل GitHub Actions قبل الدمج إلى main.
