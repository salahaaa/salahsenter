# One-Command Update Channel — تحديثات Staging بخطوات قليلة

## الهدف

إلغاء الحاجة إلى نسخ ملفات يدوياً أو تذكر أوامر Git وnpm في كل تحديث.

بعد الإعداد الأول، التحديث المستقبلي في Windows يكون:

```text
1. تنزيل ZIP وملف CHECKSUM.txt المطابق
2. Double Click: tools\Apply-Mall-Update.cmd
3. اختيار ZIP ثم Y للنشر إلى staging
```

## ما يفعله updater

```text
يتحقق من Node.js 22.19+
يتحقق أن checkout الحالي على branch staging ونظيف
يتحقق من SHA-256
يفك ZIP إلى temporary directory
يتحقق من completeness manifest داخل ZIP
يحفظ backup branch محلي قبل التحديث
يحافظ على .env وGit history وnode_modules وVercel local metadata
يحدث source directories الرسمية فقط
يشغل npm ci عند تغير package-lock
يشغل npm run release:verify:source
ينشئ Git commit
يدفع إلى origin/staging فقط عند التأكيد
```

## ما لا يفعله updater

```text
لا يشغل db:migrate
لا يشغل db:push
لا يشغل db:seed
لا يغير DATABASE_URL
لا يفتح Vercel أو ينشر Production
لا يستخدم force push
لا يحذف .env أو .env.local أو .env.staging أو .env.production
```

## الإعداد الأول — مرة واحدة فقط

### المتطلبات

```text
Windows 10/11
Git for Windows
Node.js 22.19.0
GitHub login configured on the computer
نسخة المصدر الحالية مفكوكة في مجلد ثابت
```

### Git identity مرة واحدة

افتح PowerShell داخل المشروع:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

### إنشاء staging channel

Double Click:

```text
tools\Initialize-Mall-Update-Channel.cmd
```

اكتب عند الطلب:

```text
INITIALIZE_STAGING_UPDATE_CHANNEL
```

ثم أدخل رابط GitHub repository فقط في نافذة PowerShell.

السكريبت:

```text
يتعامل مع ZIP مفكوك بلا .git أو بلا أول Commit
ينشئ/يستخدم Git repository محلياً
ينشئ branch staging
ينشئ commit أولي
يدفع فقط staging إلى GitHub
```

لا يفحص `HEAD` قبل إنشاء أول Commit، ويتعامل مع غياب `origin` كحالة طبيعية ثم يطلب رابط GitHub. ولا يدفع `main` ولا Production.

## كل تحديث لاحق

ضع الملفين في Downloads مثلاً:

```text
MallOS-Update-2026-07-25.zip
MallOS-Update-2026-07-25-CHECKSUM.txt
```

تقبل الأداة أيضاً ملف `.sha256` التقليدي، لكن `CHECKSUM.txt` أسهل للتحميل والفتح في Windows.

ثم Double Click:

```text
tools\Apply-Mall-Update.cmd
```

ألصق مسار ZIP عند الطلب، مثال:

```text
C:\Users\YourName\Downloads\salahsentar22-upload-source-light.zip
```

إذا نجح الفحص، سيطلب:

```text
Push this verified update to origin/staging now? [Y/N]
```

اختر:

```text
Y
```

ثم راقب GitHub Actions على branch `staging`.

## Rollback

كل تحديث ينشئ branch محلياً مثل:

```text
backup/staging-before-update-YYYYMMDD-HHMMSS
```

إذا فشل فحص المصدر قبل commit، يعيد السكربت الملفات إلى branch backup تلقائياً.

إذا نجح update ثم احتجت الرجوع لاحقاً:

```powershell
git checkout staging
git reset --hard backup/staging-before-update-YYYYMMDD-HHMMSS
git push origin staging --force-with-lease
```

> لا تنفذ rollback push إلا عند الحاجة وبعد مراجعة ما ستعود إليه. `--force-with-lease` أفضل من `--force` لأنه يرفض الكتابة فوق تحديث جديد لم يصل إلى جهازك.

## حدود الضمان

الأداة تضمن عدم مزامنة أو دفع مصدر ناقص عندما يفشل checksum أو source verification. لكنها لا تستطيع ضمان خدمات خارجية مثل GitHub أو Vercel أو الإنترنت أو قاعدة البيانات.

لذلك النجاح العملي يصبح:

```text
ZIP verified
→ local release verification passes
→ backup branch exists
→ commit pushed to staging
→ GitHub CI verifies clean clone
→ Vercel Staging deploys from staging
```

ولا يصبح Production جزءاً من هذا المسار.
