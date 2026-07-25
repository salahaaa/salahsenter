import { sql } from "drizzle-orm";
import { backgroundJobs, db, productVariants, returnRequests, securityAlerts } from "@/lib/db";
import { hasConfiguredDatabaseUrl, isLikelyPooledDatabaseUrl } from "@/lib/db/env";
import { getRedisConfig } from "@/lib/redis/client";
import { isObjectStorageConfigured } from "@/lib/media";
import { getBackupStorageConfig } from "@/lib/backup";
import { isProductionRuntime } from "@/lib/cron/auth";
import { isPrivateDocumentStorageConfigured } from "@/lib/private-documents-storage";
import { getEnvironmentIsolationReport } from "@/lib/environment/isolation";
import { getDatabaseReadiness } from "@/lib/database-readiness";

function boolStatus(ok: boolean, label: string, description: string, severity: "ok" | "warn" | "danger" = ok ? "ok" : "danger") {
  return { ok, label, description, severity: ok ? "ok" : severity };
}

function configured(...keys: string[]) {
  return keys.some((key) => Boolean(process.env[key] && String(process.env[key]).trim()));
}

export async function getProductionReadiness() {
  const redis = getRedisConfig();
  const production = isProductionRuntime();
  const environmentIsolation = getEnvironmentIsolationReport();
  const databaseReadiness = await getDatabaseReadiness();
  const objectStorageReady = isObjectStorageConfigured();
  const emailOutboundReady = configured("EMAIL_WEBHOOK_URL", "SMTP_HOST", "RESEND_API_KEY");
  const smsOutboundReady = configured("SMS_WEBHOOK_URL");
  const transactionalOutboundReady = emailOutboundReady && smsOutboundReady;
  const stripeConfigured = configured("STRIPE_SECRET_KEY");
  const localGatewayConfigured = configured("LOCAL_GATEWAY_API_URL");
  const paymentReady = stripeConfigured || localGatewayConfigured || configured("PAYMENT_PROVIDER_API_KEY");
  const monitoringReady = configured("SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN", "UPTIME_WEBHOOK_URL", "LOG_DRAIN_URL");
  const backupStorage = getBackupStorageConfig();
  const backupReady = backupStorage.provider !== "local" && Boolean(backupStorage.bucket && backupStorage.accessKeyId && backupStorage.secretAccessKey);
  const backupMediaReady = process.env.BACKUP_MEDIA_ENABLED !== "true" || Boolean(process.env.BACKUP_MEDIA_SOURCE_HOSTS?.trim());
  const serverlessRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
  const poolMax = Number(process.env.DB_POOL_MAX || process.env.POSTGRES_POOL_MAX || (serverlessRuntime ? 3 : 10));
  const poolerReady = !serverlessRuntime || (isLikelyPooledDatabaseUrl() && Number.isFinite(poolMax) && poolMax <= 3);

  const checks = [
    boolStatus(hasConfiguredDatabaseUrl(), "DATABASE_URL", "قاعدة البيانات مضبوطة"),
    boolStatus(databaseReadiness.state === "ready", "Database schema readiness", databaseReadiness.state === "schema_incomplete" ? `migrations ناقصة أو جداول تشغيلية مفقودة (${databaseReadiness.missingTables.length})` : "تعذر التحقق من مخطط قاعدة البيانات", production ? "danger" : "warn"),
    boolStatus(!production || (environmentIsolation.enforced && environmentIsolation.ok), "Environment isolation",  "Production يتطلب namespace منفصلاً وموارد Redis/R2/backup/payment/ERP/outbound متسقة مع البيئة", production ? "danger" : "warn"),
    boolStatus(poolerReady, "Database pooler", serverlessRuntime ? "بيئة serverless تتطلب pooler فعلي و DB_POOL_MAX<=3" : "إعداد pool محلي مناسب", production ? "danger" : "warn"),
    boolStatus(Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32), "JWT_SECRET", "سر JWT طويل وقوي"),
    boolStatus(redis.backend !== "unconfigured", "Redis", "Redis مطلوب للكاش والـ rate limit", production ? "danger" : "warn"),
    boolStatus(Boolean(process.env.NEXT_PUBLIC_APP_URL), "NEXT_PUBLIC_APP_URL", "رابط التطبيق العام مضبوط", "warn"),
    boolStatus(Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 20), "CRON_SECRET", "سر cron لمعالجة jobs والعقود", production ? "danger" : "warn"),
    boolStatus(objectStorageReady || !production, "Object Storage/CDN", "في الإنتاج يجب استخدام Cloudinary/S3/R2 وعدم حفظ صور base64", production ? "danger" : "warn"),
    boolStatus(isPrivateDocumentStorageConfigured() || !production, "Private legal documents", "العقود ووثائق PDF الجديدة تتطلب bucket R2 خاصاً غير عام", production ? "danger" : "warn"),
    boolStatus(paymentReady || !production, "Payment Gateway",  "بوابة دفع فعلية أو إعدادات مزود محلي حقيقي", production ? "danger" : "warn"),
    boolStatus(!stripeConfigured || Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET.length >= 20), "Stripe webhook secret", "STRIPE_WEBHOOK_SECRET إلزامي عند تفعيل Stripe", production ? "danger" : "warn"),
    boolStatus(!localGatewayConfigured || Boolean(process.env.LOCAL_PAYMENT_WEBHOOK_SECRET && process.env.LOCAL_PAYMENT_WEBHOOK_SECRET.length >= 20), "Local gateway webhook secret", "LOCAL_PAYMENT_WEBHOOK_SECRET إلزامي عند تفعيل بوابة محلية", production ? "danger" : "warn"),
    boolStatus(transactionalOutboundReady || !production, "Email + SMS", "قناتا Email وSMS مطلوبتان لرسائل العميل والمعاملات عند الإطلاق", production ? "danger" : "warn"),
    boolStatus(monitoringReady || !production, "Monitoring/Sentry", "Sentry أو Uptime/Log drain لتتبع الأعطال", production ? "danger" : "warn"),
    boolStatus(backupReady || !production, "Durable backup target", "S3/R2 خاص مع بيانات وصول منفصلة للنسخ الاحتياطي", production ? "danger" : "warn"),
    boolStatus(backupMediaReady || !production, "Backup media allowlist", "عند تفعيل BACKUP_MEDIA_ENABLED يجب ضبط BACKUP_MEDIA_SOURCE_HOSTS", production ? "danger" : "warn")
  ];

  let metrics = {
    negativeStock: 0,
    duplicateIdempotency: 0,
    duplicateInventoryMovements: 0,
    failedJobs: 0,
    queuedJobs: 0,
    openSecurityAlerts: 0,
    openReturns: 0,
    inlineMediaRows: 0,
    inlineMediaBytesApprox: 0
  };

  try {
    const [negativeStock, duplicateIdempotency, duplicateMovements, failedJobs, queuedJobs, alerts, returns, inlineMedia] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(productVariants).where(sql`${productVariants.stockQuantity} < 0`),
      db.execute(sql`select count(*)::int as count from (select scope, key from idempotency_keys group by scope, key having count(*) > 1) t`),
      db.execute(sql`select count(*)::int as count from (select reference_id, variant_id, type from inventory_movements where reference_type='order' group by reference_id, variant_id, type having count(*) > 1) t`),
      db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(sql`${backgroundJobs.status} in ('failed','dead_letter')`),
      db.select({ count: sql<number>`count(*)::int` }).from(backgroundJobs).where(sql`${backgroundJobs.status} in ('queued','retry','processing')`),
      db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(sql`${securityAlerts.status} = 'open'`),
      db.select({ count: sql<number>`count(*)::int` }).from(returnRequests).where(sql`${returnRequests.status} in ('requested','approved','received')`),
      db.execute(sql`
        select coalesce(sum(row_count),0)::int as count, coalesce(sum(bytes_approx),0)::bigint as bytes
        from (
          select count(*) filter (where image_url like 'data:image/%')::int as row_count, coalesce(sum(length(image_url)) filter (where image_url like 'data:image/%'),0)::bigint as bytes_approx from banners
          union all
          select count(*) filter (where image_url like 'data:image/%')::int, coalesce(sum(length(image_url)) filter (where image_url like 'data:image/%'),0)::bigint from announcements
          union all
          select count(*) filter (where creative->>'imageUrl' like 'data:image/%')::int, coalesce(sum(length(creative->>'imageUrl')) filter (where creative->>'imageUrl' like 'data:image/%'),0)::bigint from ad_campaigns
          union all
          select count(*) filter (where image_url like 'data:image/%')::int, coalesce(sum(length(image_url)) filter (where image_url like 'data:image/%'),0)::bigint from admin_promotional_offers
          union all
          select count(*) filter (where image_url like 'data:image/%')::int, coalesce(sum(length(image_url)) filter (where image_url like 'data:image/%'),0)::bigint from store_offer_collections
        ) media
      `)
    ]);
    metrics = {
      negativeStock: Number(negativeStock[0]?.count || 0),
      duplicateIdempotency: Number((duplicateIdempotency as any)[0]?.count || 0),
      duplicateInventoryMovements: Number((duplicateMovements as any)[0]?.count || 0),
      failedJobs: Number(failedJobs[0]?.count || 0),
      queuedJobs: Number(queuedJobs[0]?.count || 0),
      openSecurityAlerts: Number(alerts[0]?.count || 0),
      openReturns: Number(returns[0]?.count || 0),
      inlineMediaRows: Number((inlineMedia as any)[0]?.count || 0),
      inlineMediaBytesApprox: Number((inlineMedia as any)[0]?.bytes || 0)
    };
  } catch (error) {
    checks.push({ ok: false, label: "DB Observability", description: error instanceof Error ? error.message : "تعذر قراءة مؤشرات قاعدة البيانات", severity: "danger" as const });
  }

  const operationalChecks = [
    boolStatus(metrics.negativeStock === 0, "No negative stock", `${metrics.negativeStock} متغير بمخزون سالب`),
    boolStatus(metrics.duplicateIdempotency === 0, "No duplicate idempotency", `${metrics.duplicateIdempotency} مفاتيح مكررة`),
    boolStatus(metrics.duplicateInventoryMovements === 0, "No duplicate stock movements", `${metrics.duplicateInventoryMovements} حركات مخزون مكررة`),
    boolStatus(metrics.failedJobs === 0, "Jobs health", `${metrics.failedJobs} jobs فاشلة`, "warn"),
    boolStatus(metrics.inlineMediaRows === 0 || !production, "No inline base64 media", `${metrics.inlineMediaRows} صفوف صور inline تقريباً ${(metrics.inlineMediaBytesApprox / 1024 / 1024).toFixed(1)}MB`, production ? "danger" : "warn")
  ];

  const allChecks = [...checks, ...operationalChecks];
  const dangerCount = allChecks.filter((check) => !check.ok && check.severity === "danger").length;
  const warnCount = allChecks.filter((check) => !check.ok && check.severity === "warn").length;
  const score = Math.round((allChecks.filter((check) => check.ok).length / allChecks.length) * 100);
  return {
    score,
    dangerCount,
    warnCount,
    checks: allChecks,
    metrics,
    environmentIsolation: {
      environment: environmentIsolation.environment,
      enforced: environmentIsolation.enforced,
      ok: environmentIsolation.ok,
      failedChecks: environmentIsolation.checks.filter((check) => !check.ok).map((check) => check.key)
    },
    databaseReadiness: {
      state: databaseReadiness.state,
      missingTables: databaseReadiness.missingTables,
      checkedAt: databaseReadiness.checkedAt
    },
    generatedAt: new Date().toISOString()
  };
}
