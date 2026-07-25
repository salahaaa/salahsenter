# إعداد Google Login

تمت حماية مسار Google OAuth بـ state cookie وPKCE. لكي يعمل، يجب أن تتطابق إعدادات Google Cloud وبيئة التطبيق **حرفياً**.

## 1. Google Cloud Console

1. افتح Google Cloud Console → APIs & Services → Credentials.
2. أنشئ **OAuth client ID** من النوع **Web application**.
3. أضف Authorized JavaScript origins:
   ```text
   http://localhost:3000
   https://your-domain.example
   ```
4. أضف Authorized redirect URIs بالمسار الكامل:
   ```text
   http://localhost:3000/api/auth/google/callback
   https://your-domain.example/api/auth/google/callback
   ```
5. انسخ Client ID وClient Secret إلى secret store فقط.

## 2. Environment variables

```env
GOOGLE_CLIENT_ID=<google-web-client-id>
GOOGLE_CLIENT_SECRET=<google-web-client-secret>
GOOGLE_REDIRECT_URI=https://your-domain.example/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

- لا تضع Client Secret في أي `NEXT_PUBLIC_*` variable.
- في Vercel preview/staging استخدم redirect URI مسجلاً خاصاً ببيئة preview، أو OAuth client منفصلًا للـ staging.
- في الإنتاج يجب أن يكون redirect URI HTTPS وينتهي بالمسار exact أعلاه.

## 3. اختبار

1. افتح `/login` ثم اضغط «الدخول عبر Google».
2. بعد اختيار الحساب، يجب أن يعود المتصفح إلى `/api/auth/google/callback` ثم إلى الصفحة المطلوبة داخل المنصة.
3. إذا ظهرت `redirect_uri_mismatch`، انسخ URI من البيئة إلى Google Console حرفياً؛ اختلاف protocol أو domain أو trailing path يكفي للفشل.
4. إذا ظهرت رسالة إعداد غير مكتمل، تحقق من variables في بيئة النشر الفعلية ثم أعد deployment.

## الحماية المطبقة

- State عشوائي مرتبط بـ HTTP-only cookie.
- PKCE `S256` verifier/challenge.
- مقارنة state بزمن ثابت.
- منع open redirect في `next`.
- تنظيف cookies بعد النجاح أو الفشل.
- استخدام `NEXT_PUBLIC_APP_URL`/`GOOGLE_REDIRECT_URI` الثابت بدل الاعتماد غير الآمن على Host header في production.
