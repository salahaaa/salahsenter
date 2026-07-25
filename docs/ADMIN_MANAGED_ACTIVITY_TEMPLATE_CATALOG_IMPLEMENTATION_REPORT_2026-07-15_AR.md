# تقرير تنفيذ: كتالوج قطاعات إداري قابل للتخصيص للتاجر

**التاريخ:** 2026-07-15
**الحالة:** مكتمل محلياً ومتحقق آلياً.

## ما تم تنفيذه

### لوحة الأدمن
أضيفت:
```text
/admin/activity-templates
```

وتسمح للأدمن بإضافة قطاع كامل بلا برمجة عبر حقول بشرية:
- اسم وكود ومجموعة القطاع.
- تصنيفات، سطر لكل تصنيف.
- وحدات بيع بصيغة الاسم/الرمز.
- خصائص بصيغة الاسم/نوع العرض/القيم.
- مقاسات وألوان.
- منتجات بداية بصيغة الاسم/التصنيف/الوصف.
- تنبيه قطاعي.
- تفعيل وتعطيل القطاع.

### ما يراه التاجر
API القوالب يدمج القوالب النظامية مع القطاعات النشطة التي أضافها الأدمن. يظهر القطاع الإداري في القائمة المستطيلة والمعاينة كأي قالب جاهز.

### منتجات البداية
عند اختيار التاجر «إضافة منتجات بداية»، تنشأ المنتجات من كتالوج الأدمن بهذه السياسة:
```text
status = draft
price = 0
stock = 0
لا نشر
لا قيود مالية
```

يوجد marker لكل store/template/version يمنع تكرار منتجات البداية عند إعادة تطبيق القالب، بينما تبقى taxonomy قابلة للـ upsert.

## البيانات والصلاحيات
- أضيف الترحيل `0079_admin_managed_activity_template_catalog`.
- جدول `merchant_activity_template_catalog` يحفظ code/name/sector/config/status/version/audit users.
- صلاحية `activity_templates.manage` جديدة، مع fallback `products.manage` و`master.manage` للأدوار الحالية.
- لا HTML/JS أو أسرار داخل config، وZod يحد القوائم والأطوال والأنواع.

## التحقق
- `npm run lint`: **نجح**.
- TypeScript: **نجح**.
- `npm test`: **نجح** — 60 ملف اختبار و161 اختباراً.
- `npm run migrations:verify`: **نجح** — 80 SQL / 80 journal entries.
- `npx drizzle-kit check --config=drizzle.config.ts`: **نجح**.
- `npm run security:verify`: **نجح**؛ secrets وAdmin guards وnpm audit ناجحة.
- `git diff --check`: **نجح**.

## حدود قبل Production
- لم تطبق migrations على Staging/Production.
- لم تختبر تطبيق starter products على PostgreSQL حي أو مع default unit غير متاح.
- لم يشغّل next build في Arena بسبب قيد الذاكرة؛ يؤكد في CI/Vercel.
