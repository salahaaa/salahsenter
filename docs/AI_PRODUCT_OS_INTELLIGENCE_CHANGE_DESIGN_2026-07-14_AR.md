# تصميم ذكاء Product OS المتقدم

## النطاق

- Blueprint للصنف: category, attributes, variants, SKU/internal code, internal barcode, supplier match, price benchmark.
- Vision/OCR adapters تعمل فعلياً عند تهيئة OpenAI/Gemini، وتفشل بوضوح عند وضع rules بدلاً من اختراع specifications.
- Bulk import repair plan لملفات كبيرة، يقدم validation/fixes قبل الحفظ.
- تطبيق blueprint فقط بعد موافقة التاجر؛ السعر والنشر والمخزون لا تتغير تلقائياً.

## حدود مهمة

- barcode الداخلي ليس GS1/EAN رسمي، ويجب تسميته بوضوح Internal Reference.
- benchmark السعر من بيانات المنصة الداخلية فقط؛ لا يدعي منافسين خارجيين بلا مزود بيانات قانوني.
- OCR للفواتير لا ينشئ التزاماً مالياً ولا stock receipt تلقائياً.
- إنشاء attribute/store taxonomy وvariants مرتبط بموافقة صريحة وتدقيق.
