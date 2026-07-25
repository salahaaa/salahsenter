# Salah Center Local Sync Agent — ERP Bridge

```text
Desktop ERP / POS / Accounting
        ⇅ (local connector)
Local Sync Agent (.NET 8 + SQLite durable inbox/outbox)
        ⇅ HTTPS only
Salah Center Integration API
```

## ما ينفذه Agent الآن في الكود

- تسجيل Agent وHeartbeat بعد أن يفتح الأدمن ERP Mode للمتجر المعتمد فقط.
- دفع المخزون المحلي إلى المنصة؛ Product Push معطل افتراضياً لأن المنتج/الوصف/الصورة/السعر مصدرها المنصة/التاجر.
- سحب طلبات المنصة وأحداثها إلى SQLite inbox، ثم تطبيقها محلياً قبل اعتبارها منجزة.
- تأكيد أحداث المنصة فقط بعد نجاح تطبيقها محلياً.
- SQLite outbox مع retry/backoff وdead-letter محلي، وإعادة دفع العناصر المتأخرة بعد انقطاع الشبكة.
- SQL Server / Access: أوامر staging parameterized قابلة للتكوين (`ApplyOrderCommand`, `ApplyEventCommand`). لا يوجد no-op صامت.
- CSV/Excel: تصدير أوامر وأحداث المنصة إلى مجلدي inbound JSON ليقرأهما برنامج الاستيراد المحلي.
- مفتاح Agent من `SALAH_SYNC_API_KEY` أو Windows DPAPI (`ApiKeyProtectedPath`)؛ لا تضع مفتاحاً حقيقياً داخل `appsettings.json`.

## قبل التثبيت

1. افتح ERP Mode من الأدمن لمتجر واحد بعد الشهادة.
2. أنشئ Integration Client بنطاق store صحيح.
3. أنشئ Mapping Profiles للمنتجات والمخزون والطلبات والفواتير، إضافة إلى warehouse/branch/customer/payment/price-list mapping.
4. أنشئ في SQL Server/Access جداول staging أو Plugin يستقبل الأوامر، ثم ضع أوامر parameterized في الإعدادات.
5. اضبط `SALAH_SYNC_API_KEY` في Windows Service environment أو أنشئ ملف DPAPI محمي للمستخدم الخدمي.

## تشغيل تطويري فقط

```powershell
$env:SALAH_SYNC_API_KEY = "secret-returned-once-by-admin"
dotnet restore
dotnet run --project LocalSyncAgent.csproj
```

## حدود صريحة قبل Pilot Production

- لا توجد في هذا المستودع Adapter رسمي مختبر لنظام محاسبي أو Onyx أو ERP محدد.
- لم يُبن Agent داخل Arena لأن `dotnet` غير متاح هنا.
- يلزم Windows Service installer، توقيع binary، updater، diagnostics bundle، وسياسة مراقبة مركزية قبل توسيع التثبيتات.
- يجب إجراء E2E حقيقي: ERP sandbox → Agent → API → invoice/payment/inventory → reconciliation.
