# تقرير الفحص الشامل للمصدر قبل النشر والتشغيل

**التاريخ:** 2026-07-19  
**المصدر المفحوص:** `/home/user/salahsentar22`  
**النطاق:** فحص محلي للمصدر الحالي فقط. لم يتم الرفع إلى GitHub، ولم تُشغَّل أي migration أو seed أو purge على قاعدة Staging أو Production، ولم تُغيَّر إعدادات Vercel.

## النتيجة التنفيذية

- **لا توجد أخطاء TypeScript أو ESLint أو اختبارات وحدات فاشلة في المصدر الحالي.**
- **تم العثور على مانع فعلي محتمل لتطبيق الهجرات في قاعدة جديدة/متأخرة وتم إصلاحه.**
- بعد اجتياز الفحوص النهائية أدناه، يكون المصدر **جاهزاً للرفع إلى GitHub**.
- لا يعني ذلك أنه **جاهز للإطلاق التشغيلي الحقيقي** قبل تطبيق الهجرات واختبار Staging وربط الخدمات الفعلية ومراجعة إعدادات البيئة.

## المانع الذي تم اكتشافه وإصلاحه

### `P0` — `CREATE INDEX CONCURRENTLY` داخل Drizzle migration

كان الملف:

```text
drizzle/0024_search_pg_trgm_indexes.sql
```

يستخدم `CREATE INDEX CONCURRENTLY`. مشغّل Drizzle مع `postgres-js` ينفّذ الهجرات المعلقة ضمن transaction، بينما PostgreSQL يرفض `CREATE INDEX CONCURRENTLY` داخل transaction. لذلك كان من الممكن أن يفشل الأمر:

```bash
npm run db:migrate
```

في قاعدة جديدة، أو في قاعدة لم تصل سابقاً إلى الهجرة `0024`.

### الإصلاح المنفذ

1. استُبدلت أوامر إنشاء الفهارس بأوامر `CREATE INDEX IF NOT EXISTS` المتوافقة مع transaction.
2. أضيفت ملاحظة توضح سبب ذلك وسلوك قواعد البيانات التي سجّلت الهجرة سابقاً؛ هذه القواعد لا تعيد تشغيل الهجرة.
3. تم تطوير الحارس:

```text
scripts/verify-migration-journal.mjs
```

ليمنع تلقائياً عمليات PostgreSQL غير الآمنة داخل transaction في سجل الهجرات المُدار، ومنها:

- `CREATE/DROP INDEX CONCURRENTLY`
- `REINDEX ... CONCURRENTLY`
- `VACUUM`
- `CREATE/DROP DATABASE`
- `CREATE/DROP TABLESPACE`
- `CLUSTER`

لا توجد migration جديدة في هذا الإصلاح، لذا يبقى سجل `drizzle/meta/_journal.json` كما هو ومتوافقاً مع **86** ملف migration.

## الفحوص المنفذة

| المجال | النتيجة |
|---|---|
| تثبيت نظيف مطابق لقفل الحزم | `npm ci` نجح؛ 731 حزمة؛ 0 ثغرات معلنة من npm audit |
| مسارات وأسماء الملفات | `npm run check:paths` نجح؛ أسماء ASCII آمنة للرفع |
| ESLint | `npm run lint` نجح |
| TypeScript | `NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck` نجح |
| اختبارات الوحدة | `npm test` نجح: **62** ملفاً و**169** اختباراً |
| ترابط migrations | `npm run migrations:verify` نجح: **86 SQL / 86 journal entries** |
| Drizzle metadata/schema | `npx drizzle-kit check --config=drizzle.config.ts` نجح |
| الأمن | `npm run security:verify` نجح: لا أسرار متتبعة، ولا API routes إدارية بلا guard، و0 ثغرات عالية/حرجة |
| نظافة Git diff | `git diff --check` نجح |
| تعارضات الدمج | لا توجد markers من نوع `<<<<<<<`, `=======`, `>>>>>>>` |
| GitHub Actions | ملفات YAML الأربعة قابلة للتحليل، وscripts التي كانت تفشل في المستودع البعيد (`check:paths`, `security:verify`) موجودة محلياً |
| Vercel manifest | `vercel.json` JSON صالح؛ جميع cron paths الأربعة عشر موجودة |
| حماية Cron | كل endpoints تحت `app/api/cron` يستخدم `getCronAuthorizationStatus` ويوقف التنفيذ عند فشل المصادقة |
| توافق Next 15 | فحص static لمسارات `params` الديناميكية لم يجد استعمالاً متزامناً غير متوافق؛ لا Edge routes تستورد driver PostgreSQL/Node APIs غير المتوافقة |
| فصل client/server | لم يُعثر على imports لـ DB/Drizzle أو `next/server` داخل client components |
| الوصولية الساكنة | لا توجد صور بلا `alt`; توجد ملاحظات UX/A11y غير مانعة أدناه |

## مراجعة التغليف والبيئة

- `package.json` يقيد Node إلى `>=20 <23`، وGitHub Actions مضبوط على **Node 22**.
- تم إجراء الفحص المحلي على Node **20.20.2**، وهو نطاق مدعوم من المشروع. يجب أن يبقى تأكيد Node 22 الفعلي ضمن GitHub Actions بعد الرفع.
- `lib/db/index.ts` متوافق مع `postgres-js` ويصدر `client` الذي تحتاجه `lib/backup.ts`.
- `next.config.mjs` يحتوي `serverExternalPackages: ["postgres"]`، وهو مطلوب لتفادي تضمين Node built-ins في bundle العميل.
- أُعيد بناء الحزمة المخففة بعد هذا الإصلاح:

  ```text
  /home/user/salahsentar22-upload-source-light.zip
  ```

  قيمة SHA-256 النهائية محفوظة بجانبها في:

  ```text
  /home/user/salahsentar22-upload-source-light.sha256
  ```

  تحتوي 1396 ملفاً تحت جذر `salahsentar22/`، وتضم `package-lock.json` و`drizzle/meta/_journal.json` وخط DejaVu، ولا تحتوي `.git` أو runtime `.env` أو `node_modules` أو `.next` أو `coverage` أو مخرجات build.
- migration `0085_store_offer_publication_schema_repair.sql` موجودة في السجل وستصلح أعمدة العرض، ومنها `store_offer_collections.publication_target`، **بعد** تطبيقها فعلياً على قاعدة البيانات الصحيحة.

## ملاحظات غير مانعة لكنها مهمة

1. **فحص accessibility الساكن:**
   - لا توجد صور بلا `alt`.
   - رصد الفحص 50 حقلاً يحتاج تحسين تعريف/تسمية (أغلبها checkboxes وfile inputs) و64 استعمالاً لـ native dialogs. هذه ليست أخطاء build أو runtime، لكنها backlog تحسين وصولية قبل الإطلاق العام.

2. **تحذيرات الاعتمادات من npm:**
   - ظهر عدد من تحذيرات deprecation لحزم عابرة (transitive dependencies)، لكن `npm audit --omit=dev --audit-level=high` نجح دون ثغرات. لا تمنع النشر الآن؛ تُراجع عند دورة تحديث dependencies مستقلة.

3. **فحص media inline وreadiness الحقيقي لم يُنفذ:**
   - يحتاج `DATABASE_URL` حقيقياً ويقرأ قاعدة البيانات، لذلك لم يُشغّل على قاعدة غير مخصصة للفحص.
   - لا يصح اعتبار ذلك فشلاً في المصدر أو تشغيله على Production لمجرد الفحص.

## ما لا يمكن الجزم به محلياً

لم يُنفذ `next build` في Arena لأن بيئة الذاكرة المحدودة معروفة بأنها قد تعطي OOM غير ممثل لـ Vercel. لذلك يجب اعتبار GitHub Actions/Vercel هو تأكيد البناء النهائي.

كذلك لا يمكن الجزم محلياً بـ:

- صحة `DATABASE_URL` وكونه pooled وقابل للاتصال من Vercel.
- تطبيق كل migrations، وخصوصاً `0085`، على قاعدة Vercel/Production.
- إعداد Redis وCloudinary/S3/R2 وSentry والنسخ الاحتياطي ومفاتيح Cron والبوابات المالية الفعلية.
- سلوك الإعلانات والفواتير وERP والنسخ الاحتياطي واستعادة البيانات تحت بيانات حقيقية.
- سيناريو purge الحساس؛ يجب أن يختبر حصراً على Staging مخصص بعد backup.

## خطوات الإغلاق المطلوبة قبل الإطلاق التشغيلي

1. ارفع المصدر الحالي كاملاً إلى فرع GitHub ثم أنشئ Pull Request.
2. تأكد من نجاح CI على Node 22، بما فيه خطوة `npm run build`.
3. أنشئ/استخدم Staging منفصلاً بقاعدة PostgreSQL وRedis وObject Storage حقيقية لكن غير إنتاجية.
4. خذ backup ثم شغّل GitHub workflow **Apply database migrations** على Staging أولاً.
5. تحقق من وجود الأعمدة التالية في `store_offer_collections` بعد migration `0085`:

   ```text
   offer_product_id
   offer_variant_id
   publication_target
   publication_state
   review_requested_at
   storefront_published_at
   homepage_approved_at
   ```

6. نفّذ اختبار QA متعدد الحسابات واختبار العرض/الطلب/الدفع النقدي وCron في Staging.
7. بعد النجاح، طبّق migrations على Production مع backup نافذ وخطة rollback، ثم أعد نشر Vercel.
8. راجع تقرير readiness في بيئة الإنتاج نفسها فقط بعد ضبط الأسرار والخدمات؛ لا تُخزّن الأسرار داخل source أو قاعدة البيانات.
