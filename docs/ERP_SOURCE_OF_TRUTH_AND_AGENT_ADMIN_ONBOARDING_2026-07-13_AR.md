# سياسة ERP المصدر الحقيقي وفتح Local Sync Agent من الإدارة

**التاريخ:** 13 يوليو 2026

## سياسة المصدر الحقيقي المعتمدة

| المجال | ERP Mode المعتمد | Standalone Mode |
|---|---|---|
| المخزون | ERP | المنصة |
| الفاتورة | ERP | المنصة |
| الإيراد المحاسبي | ERP (مرآة منصة) | المنصة |
| التسويات وpayouts | المنصة | المنصة |
| السعر | التاجر/المنصة | التاجر/المنصة |
| بيانات المنتج والوصف والصور | المنصة | المنصة |
| الحسابات البنكية | المنصة | المنصة |
| بيانات العملاء | المنصة | المنصة |

## فتح ERP للمحل

التاجر لا يستطيع تفعيل ERP Mode بنفسه. المسار الإداري:

```text
1. إنشاء Integration Client ومنح API key مرة واحدة.
2. إنشاء Mapping Profiles للمنتجات والمخزون والطلبات والفواتير.
3. تشغيل Agent تجريبي وتسجيل heartbeat.
4. فحص Certification checklist.
5. اعتماد Sandbox.
6. من صفحة شهادة ERP اضغط «فتح للمحل».
7. يكتب الأدمن integration_settings موقّعة إداريًا للمحل.
```

بعد الخطوة 7 فقط، تقبل منصة API تسجيل Agent أو heartbeat أو دفعات inventory/invoice لهذا المتجر.

## Local Sync Agent

المجلد:

```text
local-sync-agent/
```

يعتمد على .NET 8 Worker وSQLite state/outbox وSQL Server/Access/CSV connectors.

### إعداد آمن

```text
BaseUrl
ClientKey
StoreId
ApiKey (Windows Secret Store / DPAPI، وليس appsettings داخل Git)
```

### ملاحظة السياسة

`EnableProductPush=false` افتراضيًا، لأن الاسم والوصف والصور والسعر هي بيانات منصة/تاجر وليست مصدر ERP. يسمح Agent بمزامنة المخزون وإرسال الفاتورة المؤكدة وفق اعتماد المحل.

## الإقفال والتسوية

Cron المالي ينشئ لقطة `draft` لليوم السابق فقط. الإقفال الحقيقي يتطلب:

```text
draft → reviewed → closed
```

ولا يسمح بتسجيل payout مدفوع قبل اعتماده.

## المستقبل المدفوع

إعداد فتح ERP يحفظ:

```text
featureAccess.code = erp_connector
featureAccess.billing = future_paid
```

الميزة الآن تمنح إداريًا، ويمكن لاحقًا ربط فتحها تلقائيًا بإضافة الإيجار المدفوعة من دون تغيير المصدر الحقيقي أو Agent protocol.

## ما تم تفعيله برمجيًا

- `financial-strategy` يرفض ERP Mode غير المفتوح إداريًا، حتى لو حاول التاجر إرساله مباشرة.
- `createFinancialServices` يبقي settlement على المنصة في ERP وStandalone.
- واجهات Agent register/heartbeat ودفعات ERP الواردة تتحقق من أن ERP Mode مفتوح للمحل وبـ Integration Client المطابق للشهادة.
- تم تمرير `StoreId` داخل PushEnvelope للـ Local Sync Agent، حتى لا تقبل المنصة دفعة ERP بلا نطاق متجر واضح.
- منتجات ERP الواردة لا تستطيع الكتابة فوق الاسم أو الوصف أو الصورة أو السعر؛ تعامل كحدث متجاهل موثق لأن المنصة/التاجر مصدرها الحقيقي.
- `EnableProductPush=false` افتراضيًا في Agent.
- Admin Certification Screen يتيح زر «فتح للمحل» بعد شهادة `certified` فقط.
- إضافة `featureAccess: { code: "erp_connector", billing: "future_paid" }` ضمن إعداد المحل؛ الميزة تمنح إداريًا الآن ويمكن ربطها بإضافة مدفوعة لاحقًا.
- Cron الإقفال المالي ينشئ `draft` فقط؛ لا يغلق الفترة دون مراجعة بشرية.

## الفحص المحلي

| الفحص | النتيجة |
|---|---|
| ESLint | ناجح |
| TypeScript | ناجح |
| Tests | 31 ملفًا / 87 اختبارًا ناجحًا |
| Migration parity | 57 SQL / 57 journal entries |
| Drizzle check | ناجح |
| Security verification | 0 vulnerabilities |
| `git diff --check` | ناجح |

## حدود التشغيل

- لا تطبق شهادة sandbox أو Agent فعليًا من دون متجر تجريبي وبيئة ERP حقيقية.
- لا يوجد .NET SDK في بيئة Arena الحالية، لذلك لم يترجم local-sync-agent هنا.
- لا تطبق migrations أو تنشر Agent أو Vercel من هذه الجلسة.
