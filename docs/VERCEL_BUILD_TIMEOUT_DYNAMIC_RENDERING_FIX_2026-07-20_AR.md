# إصلاح مهلة Vercel Build لصفحات الأدمن و/_not-found

**التاريخ:** 2026-07-20  
**سبب البلاغ:** Vercel أعاد محاولة بناء صفحات مثل `/admin/ads` و`/admin/cms` بعد تجاوز 60 ثانية، ثم فشل `/_not-found` وانتهى `npm run build` بخروج worker.

## السبب الجذري

كانت عشرات صفحات الأدمن والتاجر التي تعتمد على:

```text
requireAuth
صلاحيات
PostgreSQL
إعدادات محتوى
```

لا تملك دائماً `dynamic = "force-dynamic"` داخل الصفحة نفسها، ولم يكن هناك layout مشترك يفرض ذلك. لذلك قد يحاول Next توليدها مسبقاً وقت Vercel Build، فتعمل استعلامات قاعدة البيانات أثناء البناء وتتجاوز مهلة 60 ثانية.

كما أن Root Layout يستدعي tenant context والهوية ومحتوى عام؛ عند بناء `/_not-found` قد يؤدي اتصال PostgreSQL غير المتاح/البطيء إلى تكرار المهلة.

## الإصلاح المنفذ

### 1. فرض Dynamic Rendering على مستوى المنصة

أضيف إلى:

```text
app/layout.tsx
```

```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

وبذلك لا يعتمد التطبيق على static export لصفحات تستخدم بيانات حية.

### 2. Layout ديناميكي للأدمن والتاجر

أضيف:

```text
app/admin/layout.tsx
app/merchant/layout.tsx
```

وكلاهما يفرض:

```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

وهذا يغطي تلقائياً صفحات مثل:

```text
/admin/ads
/admin/cms
/admin/settings
/admin/products
/merchant/orders
/merchant/products
```

دون الحاجة لإضافة نفس السطر في عشرات الصفحات.

### 3. منع اتصالات DB في مرحلة Next Build

أضيف:

```text
lib/runtime-phase.ts
```

وفي مرحلة:

```text
NEXT_PHASE=phase-production-build
```

تعيد الخدمات قيماً افتراضية ولا تفتح اتصال PostgreSQL في:

```text
lib/tenancy/context.ts
lib/platform-identity.ts
lib/home-content.ts
lib/welcome-popup.ts
lib/text-center/service.ts
```

وهذا يحمي Root Layout و`/_not-found` من انتظار قاعدة بيانات وقت البناء.

### 4. حماية اختبارية

أضيف:

```text
tests/build-prerender-policy.test.ts
```

للتحقق من:

- وجود Dynamic Rendering في root/admin/merchant layouts.
- وجود Build Phase guards في tenant والهوية والمحتوى والترحيب.

## النتيجة المحلية

- `npm run lint` ✅
- `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` ✅
- `npm test` ✅ — **66** ملفاً / **178** اختباراً
- `npm run migrations:verify` ✅ — **87 / 87**
- `npx drizzle-kit check --config=drizzle.config.ts` ✅
- `npm run security:verify` ✅
- `git diff --check` ✅

## ما يجب فعله في Vercel

1. ارفع المصدر الحالي كاملاً، لا جزءاً من الملفات.
2. تأكد أن Vercel يبني commit الذي يحتوي هذا الإصلاح.
3. نفذ Redeploy مع:

```text
Use existing Build Cache = OFF
```

4. لا تضف `DATABASE_URL` خاطئاً أو رابط Neon قبل تطبيق schema على قاعدة Staging؛ Dynamic Rendering يمنع build-time DB reads لكنه لا يغني عن قاعدة صحيحة وقت التشغيل.
5. إذا ظهر فشل جديد، أرسل أول Error حقيقي قبل السطر الأخير، لا رسالة worker النهائية فقط.

## حدود التحقق

لم يُشغّل `next build` في Arena بسبب حد الذاكرة المعروف؛ تأكيد البناء النهائي يجب أن يأتي من GitHub Actions/Vercel بعد رفع المصدر الحالي.
