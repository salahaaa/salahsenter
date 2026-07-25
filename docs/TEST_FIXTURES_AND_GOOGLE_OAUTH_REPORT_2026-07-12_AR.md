# تقرير تطوير: Test Fixtures وGoogle OAuth — 12 يوليو 2026

## الهدف

توفير طريقة آمنة ومتكررة لاختبار المنصة كأدمن وتاجر وعميل بدون إعادة حسابات demo ثابتة إلى المشروع، وإصلاح مسار Google Login ليكون مناسبًا للإنتاج.

---

## 1) Safe Test Fixtures

### الأمر الجديد

```bash
npm run test:fixtures
```

### ما ينشئه

في قاعدة Local أو Staging المعزولة فقط، ينشئ/يجهز:

- حساب QA أدمن.
- حساب QA تاجر مع merchant profile ومتجر نشط.
- حساب QA عميل.
- role assignments الصحيحة.
- متجر اختبار، category، منتج نشط وvariant بمخزون.
- COD payment method وshipping method.
- order status definitions اللازمة لاختبار checkout.

### الحماية

- محظور تمامًا إذا كان الهدف production.
- يحتاج `TEST_FIXTURES_CONFIRM=true`.
- لا توجد أي حسابات أو كلمات مرور أو emails افتراضية في الكود.
- كل email/password يحدده المشغل من `.env.local` غير المتتبع أو من staging secret manager.
- كلمة المرور 16 حرفًا على الأقل، وترفض placeholder/demo patterns.
- لا تطبع كلمات المرور في terminal أو logs.
- لا يعيد تعيين كلمة مرور موجودة إلا عند `TEST_FIXTURES_RESET_PASSWORDS=true` بشكل صريح.

### الاستخدام

الدليل الكامل موجود في:

```text
docs/SAFE_TEST_FIXTURES.md
```

بعد ضبط المتغيرات المطلوبة:

```bash
npm run db:migrate
npm run test:fixtures
npm run dev
```

ثم سجّل الدخول من `/login` بقيم `TEST_ADMIN_*` أو `TEST_MERCHANT_*` أو `TEST_CUSTOMER_*` التي زودت بها أنت.

---

## 2) إصلاح Google Login

### التغييرات المنفذة

- أضيفت طبقة `lib/google-oauth.ts`.
- OAuth authorization request أصبح يستخدم:
  - random state مربوطًا بـ HTTP-only cookie.
  - PKCE `S256` verifier/challenge.
  - cookie TTL مدته 10 دقائق.
- Callback أصبح:
  - يتحقق من state بمقارنة constant-time.
  - يتحقق من PKCE verifier في token exchange.
  - ينظف state/verifier cookies صراحة بعد النجاح أو الفشل.
  - يمنع open redirect من `next` مثل `//evil.example` أو رابط خارجي.
  - يستخدم `GOOGLE_REDIRECT_URI` أو `NEXT_PUBLIC_APP_URL` بشكل موحد بين start/callback.
  - يرفض redirect URI غير HTTPS في production أو الذي لا ينتهي بـ `/api/auth/google/callback`.
  - يعطي رسائل إعداد أوضح عند غياب Google Client ID/Secret أو وجود خطأ URI.

### المطلوب منك في Google Cloud / Vercel

الدليل الكامل موجود في:

```text
docs/GOOGLE_OAUTH_SETUP.md
```

المتغيرات المطلوبة في بيئة النشر:

```env
GOOGLE_CLIENT_ID=<web-oauth-client-id>
GOOGLE_CLIENT_SECRET=<web-oauth-client-secret>
GOOGLE_REDIRECT_URI=https://your-domain.example/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

يجب إضافة redirect URI نفسه **حرفيًا** في Google Cloud Console → OAuth Web Client → Authorized redirect URIs.

> لا يمكن اختبار Google مع مزود Google الحقيقي دون Client ID/Secret/domain فعلي؛ تم اختبار منطق PKCE/state/redirect URI محليًا، ويجب إجراء اختبار sandbox بعد ضبط المتغيرات في Staging.

---

## التحقق المنفذ

| الفحص | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm test` | 14 ملفات، 38 اختبارًا ناجحًا |
| `npm run migrations:verify` | ناجح، 48 SQL / 48 journal |
| `drizzle-kit check` | ناجح |
| `npm run security:verify` | ناجح، 0 vulnerabilities / لا أسرار معروفة في 33 commit |
| تشغيل `test:fixtures` مع production env | محظور بنجاح، exit code 1 |

## اختبارات جديدة

- `tests/google-oauth.test.ts`
  - state وpost-login redirect الآمن.
  - منع open redirects.
  - PKCE pair.
  - HTTPS redirect URI في production.

---

## ملاحظة تشغيلية

التغييرات محلية ولم تُرفع أو تُعمل لها commit بعد. قبل الإنتاج، شغّل جميع اختبارات CI، طبّق migrations، ثم اضبط Google OAuth secrets وجرّب تسجيل الدخول عبر Staging أولًا.
