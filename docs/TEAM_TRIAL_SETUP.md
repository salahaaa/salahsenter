# Team Trial Setup — تشغيل نسخة تجربة مشتركة للفريق

> هذا الملف لا يحتوي أسراراً. ضع رابط قاعدة البيانات الحقيقي في `.env.local` فقط ولا ترفعه إلى GitHub.

## الهدف

تشغيل المشروع محلياً على أجهزة الفريق مع قاعدة بيانات PostgreSQL تجريبية مشتركة، بدون اشتراط Redis في هذه المرحلة.

## 1) إنشاء ملف البيئة المحلي

على كل جهاز، داخل مجلد المشروع:

```bash
cp .env.team.example .env.local
```

ثم عدّل `.env.local` وضع رابط قاعدة البيانات التجريبية في:

```env
DATABASE_URL="ضع-رابط-قاعدة-البيانات-هنا?sslmode=require"
```

> إذا كان الرابط يحتوي أصلاً على query string أضف `&sslmode=require` بدلاً من `?sslmode=require`.

## 2) إعداد Redis في نسخة التجربة

لأن هذه نسخة تجربة مشتركة وليست Production نهائي، اجعل:

```env
REDIS_REQUIRED="false"
```

هذا يسمح بتشغيل rate limiting والكاش بذاكرة الجهاز محلياً عند عدم وجود Redis.

في الإنتاج الحقيقي يجب تغييرها إلى:

```env
REDIS_REQUIRED="true"
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

## 3) التشغيل المحلي

```bash
npm ci
npm run dev
```

ثم افتح:

```txt
http://localhost:3000
```

## 4) تنبيه مهم للفريق

لا تشغلوا:

```bash
npm run db:seed
```

على قاعدة البيانات المشتركة إلا بقرار واضح، لأنه قد يضيف/يغير بيانات مشتركة.

ولا تشغلوا سكربت E2E الكامل إلا على قاعدة staging مخصصة:

```bash
E2E_ALLOW_PRODUCTION_WRITE=true npm run e2e أو السكربت المناسب
```

## 5) حسابات الدخول

استخدموا الحسابات الموجودة في قاعدة البيانات التجريبية. إن كانت seed الأصلية مستخدمة غالباً تكون:

```txt
admin@salah.center
merchant@salah.center
customer@salah.center
```

وكلمة المرور تكون حسب ما تم تهيئته عند إنشاء القاعدة.

إذا لم تعمل بيانات الدخول بعد ضبط `REDIS_REQUIRED=false` فالمشكلة تكون في كلمة المرور/الحساب وليس في Redis.

## 6) عند النشر على رابط تجربة Vercel/Render

أضف نفس المتغيرات إلى إعدادات البيئة في منصة النشر:

```env
DATABASE_URL="..."
JWT_SECRET="..."
SESSION_COOKIE_NAME="mall_session"
NEXT_PUBLIC_APP_URL="https://your-staging-url"
REDIS_REQUIRED="false"
MEDIA_PROVIDER="local"
```

ثم أعد النشر.
