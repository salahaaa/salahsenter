# تصميم توسيع دور الذكاء الاصطناعي في المنصة

**القرار المعتمد:** بنية محايدة للمزود، تنفيذ بعد موافقة بشرية، أساس مشترك للتاجر والأدمن والعميل.

## مبادئ إلزامية

- لا تخزن مفاتيح API في DB أو source؛ مزود AI عبر environment/secret manager فقط.
- لا يغير AI بيانات أو مالاً أو عقداً أو مخزوناً أو حالة طلب بلا موافقة صريحة ومسار domain محكوم.
- لا يرسل AI بيانات وثائق أو كلمات مرور أو أسرار أو بيانات دفع إلى مزود خارجي.
- كل run/proposal يسجل scope، provider mode، actor، input summary، outcome وقرار الموافقة.
- عند غياب مزود AI يعمل النظام بوضع deterministic/rule-based مفيد ولا يدعي أنه model خارجي.

## الموجة الأولى

### التاجر
- ملخص يومي: مبيعات، طلبات، مخزون، منتجات غير جاهزة، جاهزية إطلاق.
- Catalog coach: جودة المنتج، نواقص، مسودة تحسين قابلة للموافقة.
- Inventory/reorder insights.
- order/customer response drafts غير مرسلة تلقائياً.

### الأدمن
- Onboarding/document risk summary غير ملزم.
- Work queue prioritization.
- launch/readiness and collection anomalies.
- اقتراحات إجراءات مع approval/audit فقط.

### العميل
- Shopping assistant/search conversational موجود ويعزز بردود تستند إلى الكتالوج.
- اقتراحات مقارنة وتوضيح وسائل الشراء وتتبع الطلب، بلا وعود أو قرارات مالية.

## التوسع والصيانة

`ai_action_proposals` يمثل الحد الفاصل بين اقتراح النموذج والتنفيذ. كل proposal محدود العمر ومقيد بنطاق مستخدم/متجر/أدمن، ولا يصح تنفيذه من client state فقط.
