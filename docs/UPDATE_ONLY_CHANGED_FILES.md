# آلية تحديث الملفات المعدلة فقط

بدلاً من استبدال المشروع كاملاً، استخدم سكربت حزم الملفات المعدلة فقط.

## إنشاء حزمة آخر 24 ساعة

```bash
npm run updates:last24
```

سينشئ مجلداً مثل:

```txt
updates/update-YYYY-MM-DDTHH-MM-SS/
```

داخله:

```txt
files/        الملفات المعدلة بنفس مساراتها الأصلية
manifest.md  تقرير بالملفات
files.txt    قائمة مختصرة
```

## طريقة الاستبدال على جهازك

1. افتح مجلد الحزمة.
2. انسخ محتويات:

```txt
updates/update-.../files
```

3. الصقها فوق مشروعك القديم.
4. اختر:

```txt
Replace files in destination
```

لا تنسخ مجلد `updates` نفسه إلى المشروع إلا إذا أردت الاحتفاظ بالتقرير.

## إنشاء حزمة منذ وقت محدد

```bash
node scripts/export-recent-updates.mjs --since=2026-06-24T15:15:00 --out=updates
```

## إنشاء حزمة بعدد ساعات مختلف

```bash
node scripts/export-recent-updates.mjs --hours=6 --out=updates
```

## ماذا يستبعد السكربت؟

يستبعد تلقائياً:

```txt
node_modules
.next
.npm
.cache
.git
uploads
tmp
coverage
dist
build
tsconfig.tsbuildinfo
.env
.env.local
updates
```

## الفحص بعد النسخ

بعد نسخ الملفات المعدلة فقط، شغّل:

```bash
npm ci
npm run check:paths
npm run lint
npm run typecheck
npm run test
npm run build
```

إذا نجحت، ارفع إلى GitHub:

```bash
git add -A
git commit -m "Apply partial update files"
git push origin main
```

## ملاحظة مهمة

إذا كان عندك Git على جهازك، السكربت يحاول الاعتماد على Git لمعرفة الملفات المعدلة/المضافة، وهذا أدق من وقت تعديل الملفات.
إذا لم يوجد Git، يستخدم وقت تعديل الملفات خلال آخر 24 ساعة.
