# تقرير تنفيذ: معاينة تعديلات الأدمن وتحكم Layout للرئيسية

**التاريخ:** 2026-07-15
**الحالة:** مكتمل محلياً ومتحقق آلياً.

## Preview before publish
أضيفت معاينات إدارية خاصة عبر:
```text
experience_preview_sessions
0078_admin_experience_preview_sessions
```

- token مشفر hash، قصير العمر (حتى 72 ساعة)، ومقيد بمنشئه وصلاحيته.
- Preview لا يكتب إعدادات عامة ولا يغير Public Cache.
- يظهر شريط أصفر في الرئيسية يقول إنها معاينة خاصة للأدمن.
- scopes المنفذة: platform identity, theme, home content, welcome popup, home sections.
- أزرار «معاينة قبل النشر» أضيفت إلى هوية المنصة والثيم ومحتوى الرئيسية والنافذة الترحيبية ومنشئ الأقسام.

## قرار الأدمن في Layout
- أضيف `homepage.layout_mode=managed` عند نشر ترتيب layout لأول مرة.
- قبل التفعيل يعرض builder القوالب الافتراضية كـ fallback.
- بعد النشر تصبح قائمة أقسام الأدمن DB هي المصدر الوحيد للرئيسية؛ إخفاء قسم يعني لا يظهر fallback له.
- عند إنشاء أول قسم مخصص، يثبت النظام القوالب الافتراضية في DB قبل إضافة القسم حتى لا تختفي الرئيسية عرضاً.

## Experience Studio
- هوية `platform.identity` أصبحت typed وتطبق في header/footer/metadata/navbar الرئيسية.
- Theme tokens توسعت وتوجد معاينة مباشرة.
- Settings Studio نظم إلى هوية، ثيم، Hero، ترحيب، عروض، Layout.
- الأقسام المخصصة المدعومة: banner, CTA, rich text, link grid.
- لا HTML/JS حر؛ التحقق على server للروابط والصور والألوان والأكواد.
- POST/PATCH/reorder للأقسام تعطل Public Home Cache فوراً.

## التحقق
- `npm run lint`: **نجح**.
- TypeScript: **نجح**.
- `npm test`: **نجح** — 59 ملف اختبار و159 اختباراً.
- اختبارات تجربة المنصة ومعاينة الأدمن: **نجحت**.
- `npm run migrations:verify`: **نجح** — 79 SQL / 79 journal entries.
- `npx drizzle-kit check --config=drizzle.config.ts`: **نجح**.
- `npm run security:verify`: **نجح**؛ secrets وAdmin guards وnpm audit ناجحة.
- `git diff --check`: **نجح**.

## حدود قبل Production
- لم تطبق migrations على Staging/Production.
- لم تجر Visual QA على Staging ببيانات وصور حية.
- لم يُشغل next build في Arena بسبب قيد الذاكرة؛ يؤكد في CI/Vercel.
