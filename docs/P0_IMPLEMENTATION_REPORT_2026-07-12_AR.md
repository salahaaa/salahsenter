# تقرير تنفيذ وإغلاق عناصر P0 — 12 يوليو 2026

**حالة فرع العمل:** تغييرات محلية غير منشورة بعد.  
**هدف التنفيذ:** إغلاق عناصر P0 الحرجة التي رصدها التدقيق: seed/accounts، تسريب إعدادات الدفع، webhooks، migration drift، والأسرار.

---

## النتيجة

### Production Critical Issues (ضمن نطاق الكود وCI): **0 مفتوحة**

هذا الحكم مشروط بتنفيذ خطوات الـ cutover الحية في آخر التقرير: تطبيق migrations على قاعدة production، تدوير الأسرار إن لزم، وضبط webhooks في مزودي الدفع واختبار sandbox. لا يمكن الجزم بحالة قاعدة/Vercel الحقيقية دون صلاحية للوصول إليهما.

---

## 1) بيانات Seed والحسابات الافتراضية — مغلق

### ما تغير

- `scripts/seed.ts` لم يعد ينشئ مستخدمين أو مسؤولين أو متاجر أو منتجات demo.
- `npm run db:seed` **محظور صراحة في production** ويعيد exit code `1` قبل تنفيذ أي query للـ seed.
- أُزيلت fallback credentials وحسابات demo من seed وواجهة تسجيل الدخول وREADME.
- أنشئ `scripts/bootstrap-admin.ts` وcommand جديد:
  ```bash
  npm run admin:bootstrap
  ```
  ويتطلب `ALLOW_ADMIN_BOOTSTRAP=true` و`ADMIN_EMAIL` و`ADMIN_PASSWORD` بطول 16+ و`ADMIN_NAME`.
- bootstrap يرفض التنفيذ إذا وُجد super admin نشط أو إذا بدت كلمة المرور قيمة placeholder/demo.
- أُضيفت migration `0047_core_rbac_reference_data.sql` لتوفير RBAC reference data من migration history بدلاً من الاعتماد على production seed.
- scripts التي يمكن أن تنشئ fixture/demo/e2e data أصبحت محظورة في production وتتطلب confirmation flag خاصًا خارج production:
  - `import:aratat-demo`
  - `import:ui-fixtures`
  - benchmark seed
  - E2E full-cycle
  - smoke product cycle
  - fixture product enrichment

### تحقق منفذ

```text
NODE_ENV=production APP_ENV=production npm run db:seed
=> exit code 1 قبل أي كتابة
```

---

## 2) حماية `paymentMethods.config` — مغلق

### ما تغير

- أُنشئ `lib/payments/config.ts` كحد أمان مركزي.
- config الخاص بوسائل الدفع أصبح strict allow-list لحقول تعليمات الدفع فقط، مثل رقم الحساب/المحفظة/IBAN والتعليمات.
- مفاتيح API، tokens، secrets، authorization headers، gateway URLs، refund URLs، webhook URLs وextra headers لم تعد تقبل في API writes.
- API العام `/api/checkout/options` أصبح يختار حقول payment method الآمنة فقط ولا يقرأ/يرجع `config` الخام.
- APIs الأدمن والتاجر تعيد DTO آمنًا لا يحتوي `config` أو `merchantFinancialAccountId`.
- صفحة إعدادات التاجر لم تعد تمرر payment method rows الكاملة إلى browser props.
- `normalizePaymentConfig` يطبق allow-list حتى على rows قديمة في قاعدة البيانات، فلا يمكن لـ legacy secret أن يتسرب عبر response.
- integration branch-copy يمرر config عبر allow-list.
- أُنشئت migration:
  ```text
  0046_payment_method_config_hardening.sql
  ```
  وتمسح كل مفاتيح JSON غير المسموح بها من:
  - `payment_methods.config`
  - `merchant_financial_provider_accounts.config`

### تكامل البوابة المحلية

- endpoints وcredentials الخاصة بالبوابة المحلية أصبحت server-only environment configuration في `lib/payments/local-gateway.ts`:
  ```text
  LOCAL_GATEWAY_API_URL
  LOCAL_GATEWAY_REFUND_URL
  LOCAL_GATEWAY_AUTHORIZATION_HEADER
  LOCAL_GATEWAY_MERCHANT_ID
  PAYMENT_PROVIDER_API_KEY
  ```
- التاجر لا يمكنه إنشاء `gateway` provider أو إدخال URL/key/header للبوابة.
- لا يستخدم local gateway الآن أي endpoint أو credential مخزن في payment JSON.

---

## 3) Webhooks الدفع — مغلق

### ما تغير

- الاستثناء من CSRF مقصور بدقة على:
  ```text
  /api/payments/stripe/webhook
  /api/payments/local-gateway/webhook
  ```
  ولا يشمل أي مسار مشابه أو checkout العادي.
- Stripe webhook:
  - يرفض الطلب إن كان `STRIPE_WEBHOOK_SECRET` غائبًا (503).
  - يتحقق من HMAC على raw body.
  - يرفض signature قديمًا بعد tolerance قدره 5 دقائق.
  - يدعم signatures متعددة أثناء key rotation.
  - يطابق `orderPayment.transactionReference` مع Stripe session ID قبل تعليم الطلب paid.
- local gateway webhook:
  - يرفض الطلب إن كان `LOCAL_PAYMENT_WEBHOOK_SECRET` غائبًا.
  - يتحقق HMAC على raw body.
  - يتطلب event ID ثابتًا من المزود.
  - يطابق transaction reference قبل تعديل order/payment.
- Replay protection:
  - كل webhook يُدخل داخل `payment_provider_events` ضمن transaction.
  - unique `(provider, event_id)` هو حاجز الإعادة.
  - event مكرر ينتهي كـ duplicate قبل أي mutation للطلب أو الدفع.
- Audit:
  - تسجل كل نتيجة webhook: accepted، duplicate، rejected signature، invalid payload، missing configuration، unmatched payment، أو processing error.
  - يسجل SHA-256 للـ payload بدل raw payload في audit log.
  - تم تعزيز audit sanitizer لحجب مفاتيح API وtokens وsecrets وauthorization وsignatures.

---

## 4) Drizzle migrations وschema drift — مغلق

### ما تغير

- أضيفت migrations `0034` حتى `0045` إلى `drizzle/meta/_journal.json`.
- أضيفت migrations جديدتان:
  - `0046_payment_method_config_hardening`
  - `0047_core_rbac_reference_data`
- أُنشئ فحص ثابت:
  ```bash
  npm run migrations:verify
  ```
  يفشل إذا وُجد SQL خارج journal أو journal entry بلا SQL أو ترتيب غير صحيح.
- workflow `apply-migrations.yml` لم يعد ينفذ قائمة `psql -f` يدوية.
- أصبح يستخدم migration history واحدًا:
  ```bash
  npm run migrations:verify
  npx drizzle-kit check --config=drizzle.config.ts
  npm run db:migrate
  ```
- أضيف production concurrency lock وGitHub production environment إلى workflow.
- تم تعديل README وdeployment docs: `db:push` و`db:seed` ممنوعان في production.

### تحقق منفذ

```text
48 SQL migration files
48 journal entries
missing_from_journal = []
missing_sql = []
```

---

## 5) Security verification والأسرار — مغلق

### ما تغير

- أُنشئ:
  ```bash
  npm run security:secrets
  npm run security:verify
  ```
- الفحص يبحث في الملفات المتتبعة الحالية وفي Git history عن أنماط مفاتيح حيّة شائعة وprivate keys، ويرفض runtime `.env` المتتبع.
- CI أصبح يستعمل `fetch-depth: 0` حتى يفحص كامل التاريخ بدل آخر commit فقط.
- فحص الأسرار يتوقف صراحة إذا كان Git clone shallow.
- أُضيف فحص secret history ضمن CI.

### تحقق منفذ

```text
trackedFiles: 867
commitsScanned: 33
known live-key/private-key patterns: 0
tracked runtime .env files: 0
npm audit --omit=dev: 0 vulnerabilities
```

---

## اختبارات تم تنفيذها بنجاح

| الأمر | النتيجة |
|---|---|
| `npm run lint` | ناجح |
| `NODE_OPTIONS=--max-old-space-size=1400 npm run typecheck` | ناجح |
| `npm test` | 13 test files، 35 tests ناجحة |
| `npm run migrations:verify` | ناجح؛ 48/48 |
| `npx drizzle-kit check --config=drizzle.config.ts` | ناجح |
| `npm run security:verify` | ناجح |
| `git diff --check` | ناجح |
| production `db:seed` guard | ناجح؛ يمنع التنفيذ بـ exit 1 |
| static no-demo-credentials check | ناجح |
| static no-client-payment-config check | ناجح |

### اختبارات P0 الجديدة

- `tests/payment-config-security.test.ts`
- `tests/payment-webhook-security.test.ts`
- `tests/payment-webhook-routes.test.ts`
- `tests/csrf-webhook-exemptions.test.ts`
- تحديث `tests/audit-sanitizer.test.ts`

---

## خطوات إلزامية قبل إطلاق Production فعلي

اقرأ ونفذ الملف التفصيلي:

```text
docs/P0_PRODUCTION_CUTOVER_2026-07-12.md
```

الحد الأدنى:

1. إن تم تشغيل seed القديم على production سابقًا: عطّل/احذف حسابات demo، غيّر كلمات مرور الإدارة، ألغِ sessions، وراجع audit logs.
2. دوّر مفاتيح Stripe/local gateway وwebhook secrets إذا كانت مخزنة سابقًا في DB config أو تعرضت لأي احتمال كشف.
3. شغل GitHub workflow **Apply database migrations** على production. لا تشغل SQL يدويًا.
4. اضبط webhook secrets في Vercel/secret store فقط، ولا تضعها في JSON config.
5. سجل المسارين exact لدى مزودي الدفع واختبر sandbox: valid event، stale/invalid signature، duplicate/replay، unmatched reference.
6. راجع أن response `/api/checkout/options` لا يحتوي `config` أو secrets في متصفح حقيقي.
7. احتفظ بمخرجات migration/security verification ضمن release evidence.

---

## ملاحظة build

لم يُعاد تنفيذ production `next build` في بيئة Arena الحالية بسبب حد ذاكرة معروف من التدقيق السابق (نحو 1.9GB RAM أدى إلى OOM أثناء Next compilation). lint/typecheck/tests نجحت. يجب أن يتحقق GitHub Actions/Vercel من build النهائي على ذاكرة build الاعتيادية قبل الدمج والإطلاق.
