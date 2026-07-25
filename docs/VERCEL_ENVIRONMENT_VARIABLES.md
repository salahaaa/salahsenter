# Vercel Environment Variables

> لا ترفع `.env.local` إلى GitHub. هذا الملف موجود فقط محلياً ومضاف إلى `.gitignore`.

أضف القيم التالية في Vercel Dashboard > Project Settings > Environment Variables:

```env
DATABASE_URL=ضع_رابط_PostgreSQL_الخارجي_المتاح_من_Vercel
JWT_SECRET=ضع_قيمة_عشوائية_طويلة_جداً
SESSION_COOKIE_NAME=mall_session
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
MEDIA_PROVIDER=local
MEDIA_MAX_SIZE_MB=8
LOCAL_UPLOAD_BASE_URL=/uploads
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=ضع_قيمة_عشوائية
```

## مهم بخصوص Render PostgreSQL
إذا كانت قاعدة البيانات من Render، استخدم External Database URL وليس Internal URL، لأن Vercel لا يستطيع الوصول إلى hostname الداخلي الذي ينتهي غالباً بـ `-a`.

## بعد ضبط المتغيرات
نفّذ قبل النشر أو ضمن بيئة آمنة:

```bash
npm run migrations:verify
npm run db:migrate
npm run build

> لا تشغّل `db:seed` في production؛ الأمر محظور لحماية المنصة من أي بيانات تجريبية أو حسابات افتراضية.
```
