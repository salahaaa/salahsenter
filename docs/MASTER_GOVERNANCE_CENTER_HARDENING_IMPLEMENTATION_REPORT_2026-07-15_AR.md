# تقرير تنفيذ: Master Governance Center آمن وقابل للتشغيل

**التاريخ:** 2026-07-15  
**الحالة:** مكتمل محلياً ومتحقق آلياً.

## إصلاح حدود الصلاحية
تم استبدال Master API الحر الذي كان يمكنه قراءة كل `systemSettings` أو استقبال group/key من العميل.

الآن:
- يقرأ فقط `systemSettings.group = master`.
- لا يكتب إلا schema typed ومحددة تحت مجموعة `master`.
- لا يمكنه تغيير security, theme, homepage, payment, providers أو financial terms.
- JSON القديم يقرأ بتوافق محدود؛ تسقط قيم الأمن القديمة عمداً وتبقى Security Center المصدر الحقيقي.

## واجهة Governance جديدة
استبدلت صفحة JSON الخام بـ Master Governance Center يحتوي:
- Registry يوضح مالك كل domain والرابط إلى مصدر الحقيقة.
- Governance defaults محددة ومتحقق منها.
- Feature Flags فعالة.
- مسودات ونشر وتراجع وسجل إصدار.
- سبب تعديل اختياري وAudit لكل عملية.

لا توجد موافقة ثانية أو MFA إجبارية أو حظر أدمن.

## Runtime values الفعالة
- `allowIndependentStores` يوقف/يسمح بطلب متجر أو نشاط مستقل من التاجر على الخادم.
- `allowCommercialExposureRequests` يوقف/يسمح بطلبات الظهور التجاري من التاجر على الخادم.
- `independentStoreIdentityReuse` يحكم إعادة استخدام هوية التاجر المعتمدة للنشاط المستقل.

الإعدادات المالية والأمنية ومزودي الدفع بقيت في لوحاتها المتخصصة ولا توهم Master بأنها تملكها.

## Versioning
أضيف:
```text
0077_master_governance_versions_and_boundaries
master_settings_versions
```

- Draft لا يؤثر على التطبيق.
- Publish ينشئ نسخة منشورة ويحدث مفاتيح master فقط.
- Rollback ينشئ نسخة منشورة جديدة من نسخة سابقة ولا يحذف التاريخ.

## التحقق
- `npm run lint`: **نجح**.
- فحص TypeScript: **نجح**.
- `npm test`: **نجح** — 57 ملف اختبار و156 اختباراً.
- `npm run migrations:verify`: **نجح** — 78 SQL / 78 journal entries.
- `npx drizzle-kit check --config=drizzle.config.ts`: **نجح**.
- `npm run security:verify`: **نجح**؛ secrets وAdmin guard audit وnpm audit ناجحة.
- `git diff --check`: **نجح**.

## ما لم ينفذ
- لم تطبق migrations على Staging/Production.
- لم يجر اختبار UI/E2E حقيقي لحفظ draft/publish/rollback مع PostgreSQL حي.
- لم يُشغّل `next build` في Arena بسبب قيد الذاكرة؛ يؤكد في CI/Vercel.
