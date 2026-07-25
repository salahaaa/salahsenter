# تقوية قنوات Email وSMS قبل الإطلاق

**التاريخ:** 2026-07-20

## النطاق

قرار الإطلاق المعتمد هو Email + SMS للعملاء. النظام يعتمد Provider-Neutral Webhooks ولا يربط المصدر بمزود محدد.

## المشكلة السابقة

- عند تفعيل القناة دون Webhook، كان بيئة غير مضبوطة تسجل input كامل في logs، بما قد يحتوي رقم هاتف أو رسالة عميل.
- لا توجد مهلة صريحة لطلب Webhook.
- Release Readiness كان يعتبر أي قناة من Email/SMS/WhatsApp كافية، رغم قرار الإطلاق Email + SMS.

## الإصلاحات

### Outbound delivery

في `lib/outbound.ts`:

- إضافة `OUTBOUND_WEBHOOK_TIMEOUT_MS` بقيمة افتراضية 10 ثوانٍ، وحد أدنى/أعلى آمن.
- استخدام `AbortSignal.timeout` لطلبات webhook.
- منع log للمرسل/المستلم/الرسالة عند عدم إعداد القناة؛ يسجل metadata حمراء فقط.
- في Production، القناة المفعلة دون URL أو مع URL غير HTTPS تفشل بوضوح لتدخل queue retry/dead-letter بدلاً من ادعاء الإرسال.
- إضافة `template=account_activation` للرسائل التلقائية عند تفعيل الحساب.

### Release Gate

في `lib/production/readiness.ts`:

```text
Email + SMS
```

أصبحا شرطين منفصلين للإطلاق في Production، لا مجرد وجود قناة واحدة.

### متغيرات البيئة

أضيف إلى templates:

```env
OUTBOUND_WEBHOOK_TIMEOUT_MS=10000
```

القيم المطلوبة لاحقاً في Vercel:

```env
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_WEBHOOK_URL=https://...
EMAIL_WEBHOOK_TOKEN=...
SMS_NOTIFICATIONS_ENABLED=true
SMS_WEBHOOK_ENABLED=true
SMS_WEBHOOK_URL=https://...
SMS_WEBHOOK_TOKEN=...
OUTBOUND_WEBHOOK_TIMEOUT_MS=10000
```

## اختبارات

أضيف `tests/outbound-delivery-policy.test.ts` للتحقق من:

- عدم تسجيل payload العميل عند غياب الإعداد.
- وجود timeout للطلبات الخارجية.
- فرض HTTPS في Production.
- اشتراط Email وSMS في readiness.

## حدود التشغيل

لم يتم ربط مزود Email أو SMS فعلي أو إرسال رسالة حقيقية. يجب اختبار Webhook المزود المختار في Neon/Vercel Staging قبل Production.
