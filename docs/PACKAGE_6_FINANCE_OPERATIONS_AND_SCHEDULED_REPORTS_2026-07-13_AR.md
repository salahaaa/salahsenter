# تقرير الحزمة 6 — المالية والتشغيل والتقارير المجدولة

## جداول جديدة

```text
scheduled_reports
scheduled_report_deliveries
```

- تعريف التقرير، نوعه، تكراره، المنطقة الزمنية، المستلمين، الصيغة، آخر/التالي run.
- سجل delivery ثابت يحتوي snapshot وحالة التوليد/التسليم والخطأ.

## المنفذ

### التقارير المجدولة

```text
lib/reports/scheduled.ts
app/api/admin/reports/schedules
app/api/cron/reports/scheduled
components/finance/scheduled-reports-panel.tsx
```

- تقرير مالي يومي/أسبوعي/شهري مبني على `calculateFinancialCloseSnapshot`.
- تقرير ERP reconciliation.
- CSV أو JSON يرسل عبر طبقة outbound email الحالية عند تجهيز `EMAIL_WEBHOOK_URL` والتفعيل.
- إذا لم يُجهز مزود بريد، يحفظ النظام التقرير كـ `generated` ولا يدعي أن البريد أرسل.
- Cron جديد:

```text
/api/cron/reports/scheduled?limit=25
0 11 * * *
```

### الواجهة

تمت إضافة إدارة التقارير المجدولة إلى:

```text
/admin/reports
```

وتشمل: تعريف التقرير، مستلمين، تكرار، CSV/JSON، تفعيل/إيقاف، وآخر حالة delivery.

### مسار الإقفال والتسويات

الحزمة تبني فوق الموجود فعلاً:

```text
draft → reviewed → closed → reopen
```

مع منع دفع السحب قبل الاعتماد، وإبقاء cron المالي لقطة مسودة تحتاج مراجعة بشرية.

## حدود صريحة

- لم يتم إرسال بريد فعلي لأن Email Webhook/SMTP/Resend غير مهيأ في Arena.
- CSV وJSON مدعومان؛ PDF حقيقي يحتاج محرك PDF/خدمة rendering مع storage للملف قبل اعتباره تسليماً.
- لم تُنفذ مطابقة بنكية خارجية لأن مزود بنكي/محفظة حي غير متاح.

## التحقق

```text
tests/scheduled-reports.test.ts                    PASS
npm run lint                                      PASS
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck   PASS
npm test                                          PASS — 38 ملفات / 107 اختبار
npm run migrations:verify                         PASS — 61 SQL / 61 journal entries
npx drizzle-kit check                             PASS
npm run security:verify                           PASS
git diff --check                                  PASS
```
