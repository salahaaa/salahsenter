# Staging R2 Backup + Isolated Recovery Drill + Evidence

**التاريخ:** 23 يوليو 2026  
**النطاق:** تطوير مصدر وخطوات CI فقط. لم تُنشأ نسخة أو استعادة أو R2 حقيقية في هذه الحزمة.

## الهدف

تحويل النسخ الاحتياطي من «ملف يمكن إنشاؤه» إلى تمرين استعادة قابل للإثبات، مع منع أي استعادة اختبارية من لمس قاعدة المصدر أو Production.

المسار المعتمد:

```text
Staging source database
        │
        ├─ create JSON backup → Staging R2 backup bucket
        │                         └─ SHA-256 metadata
        │
        └─ restore verified backup → isolated Staging recovery database
                                      └─ table-by-table count verification
```

## ما أضيف

### 1) Migration 0087

أضيف:

```text
drizzle/0087_backup_recovery_target_authorization.sql
```

وتمت إضافته فوراً إلى:

```text
drizzle/meta/_journal.json
```

ينشئ الجدول:

```text
backup_recovery_targets
```

هذا ليس جدول بيانات تجارية. هو marker تحكم موجود في قاعدة Recovery فقط بعد تهيئتها المقصودة، ويثبت أن هذه القاعدة سمح لها أن تكون هدف استعادة مدمر.

حقوله المهمة:

```text
environment
target_label
target_fingerprint
is_active
last_drill_at
last_drill_status
last_backup_file
last_backup_sha256
last_verified_at
```

الجدول مستبعد صراحة من backup ومن truncate/restore. لذلك لا يمكن أن تنسخ علامة التفويض من قاعدة Staging المصدر إلى هدف آخر، ولا تختفي بعد تمرين استعادة ناجح.

### 2) بصمة R2/S3 قبل الاستعادة

أضيف التحقق:

```text
verifyStoredBackupIntegrity()
readBackupWithIntegrity()
```

قبل استعادة النسخة البعيدة، يفعل السكربت الآتي:

1. يقرأ JSON من R2/S3.
2. يحسب SHA-256 للمحتوى الذي تم تنزيله.
3. يقرأ metadata للكائن عبر `HeadObject`.
4. يتطلب `metadata.sha256` صحيحاً.
5. يرفض الاستعادة عند اختلاف البصمة أو غيابها.

لا يقبل Staging recovery drill نسخة `local` ولا نسخة بلا metadata موثقة.

### 3) تهيئة هدف Recovery المقصود

أضيف الأمر:

```bash
npm run backup:recovery:init-target
```

ولا يعمل إلا مع:

```text
APP_ENV=staging
RECOVERY_TEST_ENVIRONMENT=staging
RECOVERY_TARGET_INITIALIZE_CONFIRM=INITIALIZE_STAGING_RECOVERY_TARGET
DATABASE_URL=<Staging source direct URL>
RECOVERY_TEST_DATABASE_URL=<separate recovery direct URL>
RECOVERY_TARGET_LABEL=<safe label>
```

يرفض إذا تطابقت هوية المصدر وهدف Recovery، قبل أي كتابة.

التهيئة لا تستعيد بيانات؛ بل تسجل marker المقصود في قاعدة Recovery بعد تطبيق migrations عليها.

### 4) Recovery drill أقوى

تم تحديث:

```text
scripts/backup/recovery-test.ts
```

ولا يعمل الآن إلا عند توفر جميع شروط الأمان:

```text
APP_ENV=staging
RECOVERY_TEST_ENVIRONMENT=staging
RECOVERY_TEST_CONFIRM=true
RECOVERY_TEST_DATABASE_URL مختلف عن DATABASE_URL
Recovery target marker موجود ومطابق لبصمة الهدف
R2/S3 backup SHA-256 metadata verified
```

ثم ينفذ:

```text
schema availability check
restore to isolated recovery target only
row-count verification for every backed-up table
update recovery marker with last verified backup
optional release-gate operational drill record
optional JSON evidence file
```

لا يطبع رابط قاعدة البيانات أو credentials أو محتوى النسخة في الدليل.

### 5) GitHub Workflow يدوي فقط

أضيف:

```text
.github/workflows/staging-backup-recovery-drill.yml
```

الاسم الظاهر:

```text
Staging backup and isolated recovery drill
```

لا يعمل إلا بعد كتابة:

```text
RUN_STAGING_BACKUP_RECOVERY_DRILL
```

تسلسله:

1. يتحقق من migration history.
2. يطبق migrations على **Recovery database فقط**.
3. يهيئ marker الهدف المقصود.
4. ينشئ backup Staging جديداً في R2، ما لم يحدد المشغل backup file موجوداً.
5. يتحقق من SHA-256 metadata.
6. يستعيد فقط إلى Recovery target.
7. يطابق counts لكل جدول.
8. يسجل `backup_recovery` evidence في Staging Release Gate عند النجاح.
9. يرفع Artifact لمدة 30 يوماً:

```text
artifacts/backup-recovery/backup-created.json
artifacts/backup-recovery/recovery-evidence.json
```

ليس في workflow أي أمر نشر Vercel أو Production.

## إعداد GitHub Environment `staging` المطلوب لاحقاً

> لا تضع القيم في المصدر أو المحادثة. لا تنفذ هذه الخطوات قبل رفع المصدر الحالي إلى GitHub.

### Secrets

```text
STAGING_DATABASE_URL
STAGING_RECOVERY_DATABASE_URL
STAGING_BACKUP_R2_ACCESS_KEY_ID
STAGING_BACKUP_R2_SECRET_ACCESS_KEY
```

### Variables

```text
STAGING_BACKUP_BUCKET
STAGING_BACKUP_R2_ENDPOINT
STAGING_RECOVERY_TARGET_LABEL
```

القواعد:

```text
STAGING_DATABASE_URL          = Neon Direct/Unpooled لقاعدة Staging المصدر
STAGING_RECOVERY_DATABASE_URL = Neon Direct/Unpooled لقاعدة Recovery منفصلة
```

ولا تستخدم Vercel runtime pooled URL في migrations أو recovery drill.

نموذج Staging المكتمل موجود في:

```text
.env.staging.example
```

ويحتوي أيضاً على:

```text
BACKUP_STORAGE_PROVIDER=r2
BACKUP_S3_PREFIX=staging/database
RECOVERY_TEST_ENVIRONMENT=staging
```

## قواعد تشغيل صارمة

- لا تستخدم Production database كقاعدة Recovery أبداً.
- لا تشغّل `backup:recovery-test` من Vercel Production.
- لا تقبل نسخة `local` كدليل Recovery Staging.
- لا تعتبر إنشاء النسخة نجاحاً؛ نجاح التمرين يعني: **R2 checksum verified + restore + table counts verified**.
- لا تحفظ backup JSON نفسه كـ GitHub Artifact؛ الـArtifact يحفظ metadata والدليل فقط.
- لا تجعل bucket Staging هو bucket Production، حتى لو استُخدمت prefixes مختلفة.

## ما لم ينفذ فعلياً

```text
- لم تُطبّق migration 0087 على Neon.
- لم يُنشأ recovery database.
- لم يُضبط R2 bucket أو credentials.
- لم يُنشأ backup في R2.
- لم تحدث استعادة أو truncate لأي قاعدة خارجية.
- لم يُشغّل GitHub workflow.
```

## التحقق المحلي

```text
npm run check:paths
npm run check:import-case
npm run lint
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck
npm test
npm run migrations:verify
npx drizzle-kit check --config=drizzle.config.ts
npm run security:verify
npm audit --audit-level=high
git diff --check
```

يوجد اختبار إضافي يغطي:

```text
- رفض source/recovery database المتطابقين.
- رفض بيئة ليست Staging.
- استبعاد marker recovery من جدول backup/restore.
- رفض init target من دون confirmation phrase.
```

### نتيجة التحقق المحلي لهذه الحزمة

```text
npm run check:paths                                      ✅
npm run check:import-case                                ✅
npm run lint                                             ✅
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck ✅
npm test                                                 ✅ 73 ملفات / 200 اختبار
npm run migrations:verify                                ✅ 88 migrations
npx drizzle-kit check --config=drizzle.config.ts         ✅
npm run security:verify                                  ✅
npm audit --audit-level=high                             ✅ 0 vulnerabilities
git diff --check                                         ✅
YAML workflows validation                                ✅
```

هذه الحزمة تجعل المصدر **جاهزاً لتنفيذ Backup + Recovery Drill موثق في Staging عند إعداد R2 وقاعدة Recovery لاحقاً**. لا تمنح أي تصريح Production ولا تثبت نجاح الاستعادة الحية قبل تشغيل workflow فعلياً.
