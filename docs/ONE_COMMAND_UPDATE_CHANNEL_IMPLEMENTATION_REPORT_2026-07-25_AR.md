# One-Command Update Channel — تقرير التنفيذ

**التاريخ:** 25 يوليو 2026  
**النطاق:** تطوير أدوات Windows محلية لتبسيط تحديث المصدر. لا يوجد commit أو push أو نشر حقيقي تم تنفيذه من Arena.

## المشكلة

تحديث المصدر كان يتطلب في كل مرة:

```text
فك ZIP
نسخ يدوي
حماية .env
npm ci
فحوص متعددة
Git add/commit/push
مراجعة CI
```

وهذا يعرض المستخدم لنقل ZIP ناقص أو فقدان `.env` أو نسيان فحص أو دفع branch خطأ.

## الحل

أضيف مسار تحديث Windows موحد:

```text
tools/Initialize-Mall-Update-Channel.cmd
tools/Apply-Mall-Update.cmd
tools/Verify-Mall-Project.cmd
```

والـPowerShell implementations المقابلة.

## الإعداد الأول — مرة واحدة

```text
Initialize-Mall-Update-Channel.cmd
```

يتطلب confirmation phrase ويعمل فقط على:

```text
Git local checkout
Node.js 22.19+
Git user.name/user.email configured
```

وينشئ/يستخدم:

```text
branch: staging
remote: origin
```

ويدفع `staging` فقط، لا `main` ولا Production.

## التحديث المستقبلي

```text
Apply-Mall-Update.cmd
```

يتطلب ZIP وملف `.sha256` sibling له. وينفذ:

```text
Node version check
Git clean staging branch check
SHA-256 validation
ZIP structural/package manifest validation
local backup branch creation
managed source synchronization
preserve .env / .env.local / .env.staging / .env.production
npm ci only when package-lock changes
npm run release:verify:source
Git commit
optional confirmed push to origin/staging
```

## الحماية

الأداة لا تنفذ:

```text
db:migrate
db:push
db:seed
vercel --prod
git push --force
```

ولا تعدل:

```text
DATABASE_URL
أي .env runtime file
Git history السابق
```

عند فشل validation قبل commit، يعيد المصدر تلقائياً إلى branch backup محلي مثل:

```text
backup/staging-before-update-YYYYMMDD-HHMMSS
```

## إصلاح Fresh Git Repository

تم اكتشاف وإصلاح خطأ عند أول تشغيل من ZIP بلا `.git`: كان السكربت يستدعي `git rev-parse --verify HEAD` بعد `git init`، بينما لا يوجد `HEAD` صالح قبل أول Commit.

أصبح السكربت الآن:

```text
يتذكر أنه أنشأ Git في نفس التشغيل
لا يستعلم عن HEAD قبل أول Commit
لا يستدعي remote get-url قبل أن يؤكد أن origin موجود
يقرأ Git user.name/user.email من config list الآمن حتى عند غيابهما
يسمح بملفات المصدر untracked في المستودع الجديد فقط
يبقى رافضاً أي تغييرات غير ملتزمة في مستودع قائم لديه Commit
```

## التحقق الآلي

أضيف:

```text
config/update-channel-manifest.json
tools/verify-update-channel.mjs
tests/update-channel-policy.test.ts
npm run update:channel:verify
```

وتصبح هذه جزءاً من:

```text
npm run release:verify:source
```

## حدود الضمان

الأداة تضمن عملياً:

```text
لا مزامنة عند SHA خاطئ
لا مزامنة عند ZIP ناقص
لا push عند فشل release verification
لا تحديث إذا working tree غير نظيف
لا overwrite لملفات البيئة
```

لكنها لا تستطيع ضمان مزود خارجي:

```text
GitHub availability
Git credential validity
Internet connectivity
Vercel runtime
Database availability
```

## ما لم يختبر في Arena

Arena لا تملك PowerShell/Windows، لذلك تم التحقق من scripts عبر static policy tests وmanifest validation، وليس تشغيل PowerShell فعلياً. أول تشغيل على كمبيوتر Windows سيكون إعداد القناة فقط، ولا ينفذ migrations أو نشر Production.

## النتائج

```text
release:verify:source                  ✅
Update channel manifest                ✅
Update channel policy tests            ✅
Client/server boundary                 ✅ 195 entries
Unit tests                              ✅ 76 files / 211 tests
Migration journal                       ✅ 88 SQL / 88 journal entries
Drizzle schema check                    ✅
Security verification                   ✅
npm audit --audit-level=high           ✅ 0 vulnerabilities
git diff --check                        ✅
```

التعليمات التشغيلية الكاملة للمستخدم موجودة في:

```text
docs/ONE_COMMAND_UPDATE_CHANNEL_2026-07-25_AR.md
```
