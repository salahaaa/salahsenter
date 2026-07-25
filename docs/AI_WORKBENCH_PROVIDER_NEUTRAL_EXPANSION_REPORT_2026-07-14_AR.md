# تقرير توسيع دور الذكاء الاصطناعي — AI Workbench

**القرار المعتمد:** Provider-neutral، تنفيذ بعد موافقة بشرية، موجة مشتركة للتاجر والأدمن والعميل.

## ما تم تنفيذه

### بوابة مزود محايدة

```text
lib/ai/gateway.ts
```

تدعم عند تهيئة الأسرار فقط:

```text
AI_PROVIDER=rules (الافتراضي)
AI_PROVIDER=openai + OPENAI_API_KEY
AI_PROVIDER=gemini + GEMINI_API_KEY
```

لا تحفظ مفاتيح API في قاعدة البيانات أو source. عند عدم وجود مزود حي يعمل النظام في وضع rules deterministic مفيد وشفاف، ولا يدعي أنه نموذج خارجي.

### سياسة الموافقة

أضيف:

```text
ai_action_proposals
```

كل اقتراح AI يحمل:

```text
audience
task type
action type
payload
risk level
provider/model
status
expiry
approvedBy/approvedAt
execution result
```

ولا يغير AI عقداً أو مخزوناً أو مالاً أو حالة طلب مباشرة. المستخدم يعتمد الاقتراح أولاً، ثم يفتح مسار domain المحكوم لتنفيذه.

### التاجر

صفحة جديدة:

```text
/merchant/ai-workbench
```

تشمل:

```text
ملخص العمليات اليومية
مخاطر المخزون
جودة الكتالوج
منتجات تحتاج تحسين
جاهزية الدفع والشحن
العملاء المتكررون
اقتراحات إعلان/عروض
```

وتبني على بيانات dashboard الفعلية وmerchant AI insights الموجودة سابقاً.

كما أضيف استوديو منتج عملي:

```text
/merchant/ai-product-studio
POST /api/ai/merchant/product-copy
```

ينشئ مسودة:

```text
عنوان
وصف مختصر
وصف طويل
كلمات مفتاحية
```

ولا يطبقها إلا بعد اعتماد التاجر. عند الاعتماد ينفذ server-side على محتوى المنتج فقط، ويحافظ على:

```text
السعر
المخزون
حالة النشر
```

### الموجة الثالثة — Customer Service وAdmin Review Lens

أضيفت مسارات متخصصة:

```text
POST /api/ai/admin/onboarding-review
POST /api/ai/admin/launch-review
POST /api/ai/merchant/order-reply
POST /api/ai/customer/shopping-plan
```

- يظهر **AI Review Lens** داخل مراجعة طلب فتح المتجر ومراجعة إطلاق المتجر؛ يعرض evidence ولا يعتمد أو يرفض تلقائياً.
- التاجر يستطيع توليد مسودة رد للعميل مرتبطة بحالة الطلب، ولا ترسل تلقائياً.
- العميل يحصل على Shopping Planner يرد من نتائج الكتالوج الفعلية فقط.

### الموجة الرابعة — Approval Inbox ودعم الطلبات

أضيفت صفحات موافقات مستقلة:

```text
/merchant/ai-approvals
/admin/ai-approvals
```

وتعرض الاقتراحات المفتوحة/المعتمدة والمنفذة ووقت انتهائها، مع فتح مسار التنفيذ الرسمي بعد الاعتماد.

كما أضيفت مسودة رد AI داخل تفاصيل طلب التاجر:

```text
POST /api/ai/merchant/order-reply
```

المسودة مبنية على حالة الطلب فقط، ويمكن نسخها أو اعتمادها، لكنها لا ترسل إلى العميل تلقائياً.

### الأدمن

صفحة جديدة:

```text
/admin/ai-workbench
```

تشمل:

```text
ترتيب طابور العمل
الطلبات والتذاكر ذات الأولوية
اقتراحات مراجعة workflow
تشغيل بعد approval فقط
```

ولا ترسل تفاصيل وثائق أو بيانات عميل أو بيانات دفع إلى مزود AI خارجي؛ الخارجي يستقبل سياقاً مجمعاً ومجهولاً فقط.

### العميل

صفحة جديدة:

```text
/ai-assistant
```

تقدم مساعداً للتسوق والبحث والمقارنة بصورة لا تعد بالسعر أو التوفر النهائي، وتوجه العميل إلى الكتالوج والمتجر الفعليين.

### APIs

```text
POST /api/ai/workbench
POST /api/ai/proposals/{id}/approve
```

## التوسع والصيانة

- سجل AI في `ai_logs` مع provider/mode/task.
- الاقتراحات منتهية بعد 24 ساعة لمنع تنفيذ توصية قديمة.
- proposal approval يسجل Audit Log.
- المستخدم لا يستطيع اعتماد proposal لا يملكه.
- لا تدخل الوثائق أو كلمات المرور أو أسرار ERP أو بيانات الدفع في external prompt.

## Migration

```text
drizzle/0070_ai_action_proposals_human_approval.sql
```

يتضمن:

```text
ai_action_proposals
صلاحيات AI للأدمن والتاجر
```

## التحقق

```text
npm run lint                         PASS
npm run typecheck                    PASS
npm test                             PASS — 49 files / 136 tests
npm run migrations:verify            PASS — 71 SQL / 71 journal entries
npx drizzle-kit check                PASS
npm run security:verify              PASS
npm audit --omit=dev                 0 vulnerabilities
git diff --check                     PASS
```

## الحدود الصريحة

1. لم يتم وضع مزود AI حي أو مفتاح API؛ الوضع الافتراضي rules local.
2. لم يتم تنفيذ mutations تلقائياً، وفق قرار approval-first.
3. لا يوجد تقييم جودة provider حي أو قياس تكلفة token قبل اختيار المزود.
4. يلزم Staging قبل تشغيل OpenAI/Gemini فعلياً، مع budget alerts وretention policy.
5. لم تطبق migration أو تنشر الصفحات على Production.

## الخطوة التالية

بعد اختيار مزود وإضافة secret في Staging، تقاس الجودة والتكلفة لكل task قبل توسيع التنفيذ. لا يفتح أي AI auto-action عالي المخاطر قبل اختبارات وrunbook وموافقة صريحة.
