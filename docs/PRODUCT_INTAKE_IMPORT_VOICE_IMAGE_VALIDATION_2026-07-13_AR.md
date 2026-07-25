# تقرير فحص استيراد الأصناف وإدخال الصوت والصورة والمتغيرات

**التاريخ:** 13 يوليو 2026
**الغرض:** التحقق من أن بيانات المنتج تصل إلى الحقول الصحيحة عند الاستيراد من CSV/XLSX وعند الإدخال النصي/الصوتي والصورة، مع توثيق حدود الاختبار بوضوح.

## النتيجة المختصرة

| المسار | نتيجة الفحص | الحكم |
|---|---|---|
| CSV عربي | تم اختباره | ناجح بعد إصلاح alias `الماركة` |
| XLSX حقيقي مولد عبر ExcelJS | تم اختباره | ناجح |
| إدخال صوتي → نص → مسودة | تم اختبار parser النصي | ناجح وظيفيًا؛ لا يمكن اختبار الميكروفون في Arena |
| رفع صورة → ربط الصورة بالمسودة والمتغيرات | تم اختبار الربط | ناجح |
| تحليل محتوى البكسلات بالصورة | غير متوفر حاليًا | ليس Vision AI حقيقيًا بعد |
| Preview الأخطاء قبل الحفظ | موجود ومختبر على parser | ناجح |
| حفظ/rollback مع قاعدة بيانات حقيقية | غير منفذ في Arena | يحتاج Postgres/E2E بيئة اختبار |

## ما تم فحصه وإصلاحه

### 1) CSV والـ XLSX

تم استخراج parser مشترك إلى:

```text
lib/products/import-file-parser.ts
```

ويعالج الآن:

```text
name / اسم المنتج
category / القسم / الصنف
brand / ماركة / الماركة / العلامة التجارية
barcode / باركود
price / السعر
stock / المخزون
image / رابط الصورة
description / الوصف
```

### نتائج الاختبارات

- CSV بعناوين عربية حقيقية:
  ```text
  اسم المنتج، القسم، الماركة، باركود، السعر، المخزون، رابط الصورة، الوصف
  ```
  وصل إلى الحقول الصحيحة.

- XLSX حقيقي تم توليده في الاختبار:
  ```text
  name, category, brand, price, stock, description
  ```
  وصل إلى `name`, `categoryName`, `brand`, `basePrice`, `stockQuantity`, `description` بشكل صحيح.

- اكتشف الفحص عيبًا في النسخة الأولى: عنوان `الماركة` لم يكن ضمن aliases. تم إصلاحه وإعادة الاختبار بنجاح.

- parser يدعم CSV quoted cells ولا يكسر الوصف الذي يحتوي على فاصلة أو سطر جديد داخل quotation.

### Preview الأخطاء

قبل الحفظ، يسجل parser:

```text
اسم المنتج مفقود
السعر غير صالح
المخزون يجب أن يكون رقمًا صحيحًا غير سالب
```

ولا يتم إدراج الصفوف ذات الأخطاء ضمن صفوف الحفظ الصالحة في واجهة الاستيراد الذكي.

## 2) الإدخال عبر الصوت

### التدفق الحقيقي

```text
SpeechRecognition في المتصفح
→ النص العربي
→ /api/merchant/product-intake/parse
→ parseProductTextToDraft
→ Draft + attributes + variants
```

### ما تم اختباره

النص التالي، وهو مماثل لما ينتج من الإملاء الصوتي:

```text
قميص رجالي قطني أزرق مقاسات M و L و XL بسعر 12000 ومخزون 20
```

تم التحقق أنه يصل إلى:

| البيانات | الحقل/النتيجة |
|---|---|
| اسم المنتج | `name` |
| الوصف | `description` و`shortDescription` |
| اللون | `attributes["اللون"]` |
| المقاسات | variants لكل من M وL وXL |
| السعر | `basePrice` وسعر كل variant |
| المخزون | `stockQuantity` لكل variant |
| التصنيف | `categoryId` عند تطابق قسم المتجر |

تم تحسين parser لالتقاط صيغة الإملاء الصوتي:

```text
مقاسات M و L و XL
```

بدل التقاط أول مقاس فقط.

### القيد

لا توجد ميكروفون أو متصفح تفاعلي في Arena، لذلك لم يُختبر `SpeechRecognition` على صوت فعلي. كذلك المتصفح نفسه هو من يوفر هذه الخاصية؛ Chrome وEdge هما المساران الأنسب، مع بقاء الإدخال النصي كبديل موثوق.

## 3) الرفع عبر الصورة

### ما يعمل الآن

عند رفع صورة عبر طبقة الوسائط ثم طلب تحليل المسودة:

```text
mainImageUrl ← رابط الصورة المرفوعة
variant.imageUrl ← رابط الصورة نفسه
variant.images ← [رابط الصورة]
```

تم التحقق برمجيًا أن رابط الصورة يصل للصورة الرئيسية ولكل variant المتولد.

### القيد الصريح

المسار الحالي **لا يحلل بكسلات الصورة بصريًا**. يكوّن المسودة من:

```text
hint الذي يكتبه التاجر
اسم الملف
بيانات التصنيفات الموجودة
```

لذلك لا يصح اعتباره Vision AI كاملًا. لتحليل المنتج من محتوى الصورة فعلًا، يلزم ربط مزود Vision معتمد، وسياسة خصوصية وتكلفة وrate limits وفحص مخرجات قبل الحفظ.

## 4) المتغيرات ووصول البيانات

التغطية الحالية بعد التطوير:

```text
المقاسات → attributes + product variants
الألوان → attributes + product variants
السعر → basePrice + variant.price
المخزون → stockQuantity + variant.stockQuantity
الصورة → mainImageUrl + variant imageUrl/images
SKU/Barcode → variant sku/barcode
الوصف → shortDescription / description
المواصفات → specifications
```

أضيف أيضًا:

```text
منع SKU مكرر داخل المنتج وعلى مستوى المتجر
استنساخ variant
Matrix Bulk Editor للسعر/المخزون
variant_change_logs
Catalog Quality Score
Product Lifecycle + scheduling
Stock Count
product_import_runs + rollback آمن عبر الأرشفة
```

## الفحص الشامل

| الفحص | النتيجة |
|---|---|
| ESLint | ناجح |
| TypeScript | ناجح |
| الاختبارات الكاملة | 30 ملفًا / 84 اختبارًا ناجحًا |
| اختبار CSV/XLSX/voice-text/image-mapping | 4 اختبارات ناجحة |
| Migration parity | 57 SQL / 57 journal entries |
| Drizzle check | ناجح — `Everything's fine` |
| Security verification | ناجح — 0 vulnerabilities |
| `git diff --check` | ناجح |

## ما يلزم قبل اعتماد إنتاجي كامل

1. تطبيق migration `0056` على قاعدة بيانات staging أولًا.
2. اختبار HTTP/E2E بحساب تاجر حقيقي وPostgres مؤقت:
   ```text
   CSV → preview → save → import run → rollback
   XLSX → preview → save
   microphone browser → draft
   media upload → image route → draft
   ```
3. اتخاذ قرار وربط مزود Vision AI إن كان مطلوبًا تحليل محتوى الصورة نفسه.
4. تأكيد نشر cron جدولة المنتجات على Vercel/GitHub Actions.
