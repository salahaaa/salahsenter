# تصميم تغيير: لوحة أدمن منظمة وحماية غير معرقلة وجاهزية Staging

**التاريخ:** 2026-07-15  
**قيد إداري معتمد:** لا MFA إجبارية، لا موافقة ثانية إجبارية، ولا تعطيل لإجراءات الأدمن. تبقى الحماية توجيهية/مدققة للأدمن، مع حظر عمليات العملاء والتجار عند الإغلاق الطارئ فقط.

## المرحلة 1 — Hardening غير معرقل
1. تضييق إعفاء CSRF لمسارات التكامل: لا يعفى POST داخل `/api/integrations/*` إلا عند وجود Bearer Token أو `x-api-key` آلي؛ الباقي يخضع CSRF كطلبات المتصفح.
2. Guard موحد لعمليات التجارة العامة يوقف checkout/payment initiation عند lockdown، ولا يستخدم في أي route إداري.
3. بطاقة «وضع وصول الأدمن» داخل Security Center:
   - حالة MFA للحساب الحالي.
   - عدد الجلسات النشطة.
   - إرشاد اختياري لتفعيل MFA مع backup/recovery codes.
   - لا تحظر الدخول أو العمليات إذا لم يفعلها الأدمن.
4. لا تعدّل self-healing أو emergency صلاحياتها، لكن توثّق أنها break-glass مدققة وليست مساراً تلقائياً.

## المرحلة 2 — لوحة أدمن موجهة للعمل
- تقسيم كتالوج الموديولات إلى: قرارات وتشغيل، تجارة وإيرادات، حماية وبنية، إعدادات وحوكمة.
- إبراز طابور الموافقات العاجلة أولاً.
- الإبقاء على كل المسارات والروابط والصلاحيات؛ التغيير تنظيمي/UX فقط ولا يبدل RBAC.

## المرحلة 3 — إثبات Staging
- Script static يمنع إضافة Admin API route بلا `requireAuth` وحارس إدارة.
- اختبارات سياسة لمسار CSRF الآلي وlockdown customer commerce.
- Runbook Staging يشمل MFA الاختيارية، RBAC سلبي، CSRF، integration API-key، lockdown، session revocation، incident/self-heal، backup recovery.
- لا يدعي تنفيذ Staging أو Pentest؛ runbook يحدد الدليل المطلوب قبل الإطلاق.

## التوسع والصيانة
- لا schema migration أو queue جديدة.
- قواعد CSRF وlockdown موضوعة في libraries صغيرة قابلة للاختبار وليس نسخاً داخل routes.
- فحص Admin route guards يضاف إلى `security:verify` ليمنع التراجع المستقبلي.

## التوافق
- Browser integrations التي لا تحمل machine credential ستحتاج CSRF مثل أي متصفح؛ Agents الحالية تستخدم API key/Bearer حسب عقد التكامل.
- لا تغيير في webhooks الموقعة المحددة.
- لا تعطيل لحسابات الأدمن أو طرق العمل الحالية.
