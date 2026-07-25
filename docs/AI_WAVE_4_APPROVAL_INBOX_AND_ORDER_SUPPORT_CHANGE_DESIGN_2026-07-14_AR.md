# تصميم الموجة الرابعة للذكاء — صندوق الموافقات ودعم الطلبات

## الهدف

جعل اقتراحات AI قابلة للمتابعة لا مجرد نتيجة مؤقتة، وتقديم AI للتاجر في صفحة الطلب الفعلية.

## النطاق

- Approval Inbox للتاجر والأدمن يعرض الاقتراحات المفتوحة/المعتمدة والمنتهية.
- مسودة رد AI داخل تفاصيل طلب التاجر، بلا إرسال تلقائي.
- AI runtime status للأدمن: provider active/rules fallback/approval policy فقط، بلا أسرار.

## السلامة

- لا يمكن اعتماد proposal خارج user scope.
- reply draft لا يرسل notification أو email أو WhatsApp.
- runtime status لا يعرض API key أو model secret.
