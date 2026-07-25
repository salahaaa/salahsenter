# تقرير تنفيذ ذكاء الأصناف والمنتجات

## المنفذ

أضيفت صفحة:

```text
/merchant/ai-product-blueprint
```

ومسار:

```text
POST /api/ai/merchant/product-blueprint
```

ينشئ Blueprint للصنف بعد اختيار منتج موجود، ويقترح:

```text
category
خصائص لون/مقاس
Variants
SKU داخلي
Internal Barcode Reference
ربط مورد مرشح
Internal price benchmark
```

التاجر يراجع Blueprint ثم يعتمد AI proposal. التنفيذ server-side فقط وبعد صلاحية المتجر.

## ما ينفذ عند الموافقة

```text
category assignment
store attributes for colors/sizes
attribute values
variants إذا لم توجد variants حالياً
product SKU/code عند غيابه
internal barcode/reference عند غيابه
supplier link عند وجود supplier مرشح
```

ولا ينفذ تلقائياً:

```text
price change
stock change
publish status
supplier receipt
financial posting
```

## Internal barcode

القيمة المقترحة بصيغة:

```text
YTC...
```

هي **مرجع داخلي** وليست GS1/EAN رسمياً ولا يجوز تسويقها كـbarcode عالمي.

## Price benchmark

الـbenchmark يعتمد فقط على أسعار منتجات المنصة ضمن الفئة والمتجر:

```text
min
median
max
sample size
```

ولا يدعي منافسين خارجيين أو سوقاً عاماً بلا مزود بيانات قانوني.

## Vision وOCR

أضيفت مسارات:

```text
POST /api/ai/merchant/image-specs
POST /api/ai/merchant/supplier-invoice
```

- عند `AI_PROVIDER=openai` ومفتاح Vision صالح، يمكن تحليل صورة منتج واستخراج مواصفات مرئية أو قراءة صورة فاتورة مورد كـdraft.
- في وضع rules، يعيد النظام بوضوح أن Vision/OCR غير مهيأ ولا يخترع مواصفات.
- PDF supplier invoice OCR يحتاج adapter PDF/Vision مهيأ؛ لا ينشئ stock أو تكلفة تلقائياً.

## Bulk import repair

أضيف:

```text
POST /api/ai/merchant/import-repair
```

ويحلل حتى 1000 صف من Import Run ويقدم:

```text
SKU repair
internal reference suggestion
variant hints
invalid price/stock flags
missing-name detection
```

وهو خطة إصلاح فقط؛ لا ينشئ 1000 منتج أو ينشرها بلا مراجعة التاجر.

## التحقق

```text
npm run lint                         PASS
npm run typecheck                    PASS
npm test                             PASS — 49 files / 136 tests
npm run migrations:verify            PASS — 71 SQL / 71 journal entries
npx drizzle-kit check                PASS
npm run security:verify              PASS
git diff --check                     PASS
```

## حدود واضحة

- لم تطبق migrations أو تنشر API على Staging/Production.
- Vision/OCR الفعلي يحتاج provider key وStaging privacy/cost review.
- supplier invoice لا ينشئ receipt أو stock حتى يراجع التاجر ويستخدم مسار cost receipt الرسمي.
- external market price comparison ليس موجوداً؛ الموجود internal platform benchmark فقط.
