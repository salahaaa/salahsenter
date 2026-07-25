# Runbook: Staging لإثبات حماية لوحة الأدمن

> هذا الدليل لا يعني أن الاختبارات نُفذت على Staging. يوثق الدليل المطلوب قبل الإطلاق.

## 1. تجهيز آمن
- حساب super_admin اختبار منفصل، وحساب platform employee بصلاحيات محدودة.
- `JWT_SECRET` و`CRON_SECRET` وRedis وSentry/Object Storage مضبوطة في Staging فقط.
- لا تستخدم بيانات عملاء أو مفاتيح Production.

## 2. RBAC سلبي
1. افتح كل `/admin/*` بحساب موظف محدود.
2. تحقق أن كل صفحة وAPI محرومان دون الصلاحية المناسبة.
3. تحقق أن إخفاء البطاقة من dashboard ليس الحماية الوحيدة؛ اطلب URL وAPI مباشرة.
4. نفذ `npm run security:admin-guards` في CI.

## 3. MFA غير المعرقلة
- سجل دخول super_admin دون MFA: يجب أن يعمل وفق القرار الحالي، مع ظهور توصية فقط.
- فعّل MFA اختيارياً، خزّن backup codes خارج النظام، ثم تحقق من login challenge.
- تحقق أن تعطيل MFA يتطلب كلمة المرور والرمز الحالي.

## 4. CSRF والتكاملات
- POST متصفح بلا CSRF إلى API عادي → 403.
- POST `/api/integrations/*` بلا API key/Bearer → 403 من middleware.
- POST Agent صالح مع `x-api-key` وclient ID صحيح → يصل إلى route ثم يمر auth/scopes.
- webhook موقّع فقط على المسارات المحددة.

## 5. Lockdown
- فعّل emergency lockdown من حساب security admin.
- تحقق أن checkout/options وpayment initiation وorders وregistration/uploads المسددة لا تنفذ.
- تحقق أن `/admin/security` ومسارات إدارة الطوارئ تبقى متاحة للأدمن.
- ألغ lockdown وسجل correlation/audit evidence.

## 6. Incident / recovery
- أنشئ Job فاشلاً تجريبياً، ثم شغّل retry/release من Security Center.
- تحقق من audit log وstructured log وnotification.
- نفذ backup recovery test على بيانات Staging منعزلة فقط.

## دليل قبول
- لقطات RBAC، مخرجات guards، IDs سجلات audit، وقت recovery، ونتيجة production readiness تحفظ في release evidence.
