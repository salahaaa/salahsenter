# تصميم دورة طلب وربط ERP عامة غير محصورة بمزود

**التاريخ:** 14 يوليو 2026  
**قاعدة الحوكمة:** لا إضافة بدون حساب التوسع، ولا إضافة بدون حساب الصيانة.

## الهدف

تحويل بناء ERP الحالي من أدوات أدمن/Agent مباشرة إلى دورة تجارية وتشغيلية واضحة للتاجر:

```text
Merchant request → Admin review → Connector assignment → Setup key
→ provisional Agent heartbeat → Mapping/external IDs → Admin readiness review
→ certified connector → Activate ERP mode
```

ولا تفترض هذه الدورة Onyx أو محاسبي أو أي مزود بعينه. Provider-specific Adapter لا يعد مدعوماً إلا بعد وجود connector catalog entry فعّال واختبارات Pilot موثقة.

## النطاق

- Catalog للموصلات، يشمل provider/type/version/connection modes/capabilities/package metadata.
- Integration request لكل متجر، مع provider/version/connection/branch/warehouse/readiness/support contact.
- provisional onboarding access للـAgent: يسمح register/heartbeat/mapping readiness فقط قبل ERP Mode، ولا يسمح orders/inventory/invoices production sync.
- Entity-link onboarding API لحفظ External IDs بلا name-only matching.
- Admin workflow: review / request-info / assign connector / issue client key / readiness / activate.
- صفحات تاجر وأدمن وصلاحيات وتدقيق.

## خارج النطاق

- لا تنزيل Installer مزعوم؛ لا يظهر Download Agent فعلي إلا عندما يوضع signed package URL في connector catalog.
- لا provider-specific database adapter أو credentials في المنصة.
- لا فتح ERP Mode أو مزامنة مالية/مخزنية production قبل certification.
- لا اتصال Cloud-to-ERP DB مباشر.

## التوسع

| المجال | القرار |
|---|---|
| providers | catalog مستقل، لا conditional logic hardcoded على Onyx/محاسبي. |
| requests | request history محفوظ؛ فهرس store/status وmerchant/status. |
| client keys | Integration Client scoped store ومفتاح يعرض مرة واحدة فقط؛ hash فقط في DB. |
| mapping | Entity links فريدة client/entity/external ID، وحزمة import محددة بـ500. |
| heartbeat | access مؤقت محدود، لا يفتح data-sync APIs قبل activation. |
| activation | certification/client/store match يتحقق server-side ثم يكتب integration settings. |

## الصيانة والمراقبة

- Owner: فريق ERP Integration Support.
- Audit: كل انتقال request، تعيين connector، إنشاء client، mapping import، activation.
- Work queue: الطلبات pending/needs-information/ready-for-certification تظهر للأدمن.
- Retry: Agent نفسه يحتفظ inbox/outbox؛ onboarding mapping endpoint idempotent بكيانات links وفهارسها.
- Runbook: connector catalog يحدد docs/support owner/package status، ولا يسمح تاجر بتجاوز certification.

## الأمان والتوافق

- التاجر يرى ويعدل طلبه فقط في نطاق متجره.
- السر لا يدخل request أو DB metadata؛ API key يرجع مرة واحدة في response للأدمن.
- onboarding Agent access منفصل عن `assertAgentStoreEnabled` الإنتاجي.
- migrations additive، ولا تغير requests/clients/mappings القديمة.
- rollback: يمكن رفض/إنهاء الطلب أو إعادة store إلى Standalone؛ لا تحذف audit/entity links.

## اختبارات مطلوبة

- حالة request transitions.
- منع activation بلا certification مطابقة.
- منع Agent onboarding من inventory/order sync قبل activation.
- provider catalog generic.
- entity external ID uniqueness/idempotency.
