# Chat Speed & Workflow

## ما تم لتخفيف المحادثة والبيئة
- حذف `node_modules` لأنه يمكن إعادة تثبيته دائماً عبر `npm ci`.
- حذف `.next` لأنه ناتج بناء ويمكن إنشاؤه عبر `npm run build`.
- حذف `.npm` والكاشات والملفات المؤقتة.
- حذف ملف ZIP قديم.
- إبقاء ملفات المشروع المصدرية فقط.

## حجم المشروع بعد التنظيف
تقريباً 7MB بدلاً من أكثر من 1GB.

## عند الحاجة للفحص من جديد
```bash
npm ci
npm run check:paths
npm run lint
npm run typecheck
npm run test
npx drizzle-kit check --config=drizzle.config.ts
npm run build
npm audit --audit-level=high
```

## أسلوب العمل لتسريع الردود
- عدم لصق مخرجات build الطويلة إلا عند وجود خطأ.
- استخدام تقارير مختصرة.
- تنفيذ المطلوب مباشرة ثم إعطاء ملخص قصير.
- إنشاء ZIP فقط عند الطلب.
