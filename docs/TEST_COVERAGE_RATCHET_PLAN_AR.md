# خطة رفع Coverage تدريجياً

## القياس الحالي

آخر قياس Vitest V8:

```text
Statements: 31.97%
Branches:   22.59%
Functions:  30.23%
Lines:      33.66%
```

لا يجوز ضبط threshold عام 50% فوراً لأنه سيحوّل CI إلى فشل شكلي لا يعالج الاختبارات الناقصة.

## Ratchet معتمد

| المرحلة | العام | Core Domain |
|---|---:|---:|
| baseline الحالي | 30% statements/lines | قياس فقط |
| المرحلة التالية | 40% | 60% للـ auth/payment/inventory/orders |
| الهدف الأول | 50% | 70% للـ core |
| هدف الاعتماد التشغيلي | 60%+ | 85%+ للمصادقة/الدفع/المخزون/الطلبات |

## قاعدة رفع النسبة

- لا تخفض coverage في أي PR.
- كل route مالية أو مخزون أو طلبات جديدة تحتاج tests موجبة وسالبة ومسار صلاحيات.
- قبل تفعيل threshold أعلى، يشغل القياس في CI كـ report لثلاث دورات ناجحة على الأقل.
- Route integration tests الحقيقية على Postgres Staging لا تستبدل Unit tests، بل تكملها.
