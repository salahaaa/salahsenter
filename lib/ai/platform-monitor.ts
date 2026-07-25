import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRedisConfig, redisCommand } from "@/lib/redis/client";
import { getProductionReadiness } from "@/lib/production/readiness";

type Severity = "critical" | "warning" | "info" | "success";
type Insight = {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  impact: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
};

function insight(input: Insight): Insight {
  return input;
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function readRedisSnapshot() {
  const config = getRedisConfig();
  if (config.backend === "unconfigured") return { configured: false, dbSize: null as number | null, infoAvailable: false };
  try {
    const dbSize = Number(await redisCommand<number>(["DBSIZE"], { context: "redis dbsize", optional: true }) || 0);
    return { configured: true, dbSize, infoAvailable: true };
  } catch {
    return { configured: true, dbSize: null, infoAvailable: false };
  }
}

export async function getPlatformAiInsights() {
  const readiness = await getProductionReadiness();
  const redis = await readRedisSnapshot();

  const [ordersNow, ordersPrev, searchNow, searchPrev, zeroSearchNow, productsMissingImages, storeMissingImages, dbConnections, queueLag, failedJobs, pendingReceipts, openReturns, pendingMerchantApplications, pendingAds, pendingStoreOffers] = await Promise.all([
    db.execute(sql`select count(*)::int as count from orders where created_at >= now() - interval '24 hours'`),
    db.execute(sql`select count(*)::int as count from orders where created_at >= now() - interval '48 hours' and created_at < now() - interval '24 hours'`),
    db.execute(sql`select count(*)::int as count from search_analytics where created_at >= now() - interval '24 hours'`),
    db.execute(sql`select count(*)::int as count from search_analytics where created_at >= now() - interval '48 hours' and created_at < now() - interval '24 hours'`),
    db.execute(sql`select count(*)::int as count from search_analytics where created_at >= now() - interval '24 hours' and result_count = 0`),
    db.execute(sql`select count(*)::int as count from products where status='active' and (main_image_url is null or main_image_url = '')`),
    db.execute(sql`
      select s.id, s.name, count(p.id)::int as missing_images
      from stores s
      join products p on p.store_id=s.id
      where p.status='active' and (p.main_image_url is null or p.main_image_url='')
      group by s.id, s.name
      order by missing_images desc
      limit 5
    `),
    db.execute(sql`select count(*)::int as used, (select setting::int from pg_settings where name='max_connections')::int as max from pg_stat_activity`),
    db.execute(sql`select count(*)::int as count from background_jobs where status in ('queued','retry','processing') and available_at <= now()`),
    db.execute(sql`select count(*)::int as count from background_jobs where status='failed'`),
    db.execute(sql`select count(*)::int as count from payment_receipts where status='pending'`),
    db.execute(sql`select count(*)::int as count from return_requests where status in ('requested','approved','received')`),
    db.execute(sql`select count(*)::int as count from merchant_applications where status in ('new','pending','under_review','waiting_for_data','documents_required','pre_approved','contract_created','contract_signed','waiting_final_approval')`),
    db.execute(sql`select count(*)::int as count from ad_campaigns where status='pending_review'`),
    db.execute(sql`select count(*)::int as count from store_offer_collections where status='pending_review'`)
  ]);

  const metrics = {
    readinessScore: readiness.score,
    dangerCount: readiness.dangerCount || 0,
    warnCount: readiness.warnCount || 0,
    redis,
    ordersLast24h: Number((ordersNow as any)[0]?.count || 0),
    ordersPrevious24h: Number((ordersPrev as any)[0]?.count || 0),
    searchLast24h: Number((searchNow as any)[0]?.count || 0),
    searchPrevious24h: Number((searchPrev as any)[0]?.count || 0),
    zeroResultSearchLast24h: Number((zeroSearchNow as any)[0]?.count || 0),
    productsMissingImages: Number((productsMissingImages as any)[0]?.count || 0),
    dbConnections: {
      used: Number((dbConnections as any)[0]?.used || 0),
      max: Number((dbConnections as any)[0]?.max || 0)
    },
    queueLag: Number((queueLag as any)[0]?.count || 0),
    failedJobs: Number((failedJobs as any)[0]?.count || 0),
    pendingReceipts: Number((pendingReceipts as any)[0]?.count || 0),
    openReturns: Number((openReturns as any)[0]?.count || 0),
    pendingMerchantApplications: Number((pendingMerchantApplications as any)[0]?.count || 0),
    pendingAds: Number((pendingAds as any)[0]?.count || 0),
    pendingStoreOffers: Number((pendingStoreOffers as any)[0]?.count || 0),
    topStoresMissingImages: storeMissingImages as unknown as Array<{ id: string; name: string; missing_images: number }>
  };

  const insights: Insight[] = [];
  const orderGrowth = pctChange(metrics.ordersLast24h, metrics.ordersPrevious24h);
  const searchGrowth = pctChange(metrics.searchLast24h, metrics.searchPrevious24h);
  const zeroSearchRate = metrics.searchLast24h ? Math.round((metrics.zeroResultSearchLast24h / metrics.searchLast24h) * 100) : 0;
  const dbUsageRate = metrics.dbConnections.max ? Math.round((metrics.dbConnections.used / metrics.dbConnections.max) * 100) : 0;

  if (!metrics.redis.configured) {
    insights.push(insight({
      id: "redis-unconfigured",
      title: "Redis غير مفعل في قراءة المراقبة",
      message: "لم يتمكن مساعد المنصة من قراءة Redis. إذا كان Redis مفعل في Vercel فتأكد أن متغيراته موجودة في نفس بيئة النشر.",
      severity: "critical",
      impact: "الكاش والـ rate limiting لا يكونان موزعين، وقد يزيد ضغط قاعدة البيانات.",
      recommendation: "اضبط UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN و REDIS_REQUIRED=true في بيئة الإنتاج.",
      evidence: { redis }
    }));
  } else if (metrics.redis.dbSize != null && metrics.redis.dbSize > 20_000) {
    insights.push(insight({
      id: "redis-growth",
      title: "نمو Redis يحتاج مراقبة",
      message: `عدد مفاتيح Redis التقريبي ${metrics.redis.dbSize}.`,
      severity: "warning",
      impact: "قد يدل على cache growth أو مفاتيح بدون TTL.",
      recommendation: "راجع TTL للمفاتيح وافحص Upstash memory/evictions.",
      evidence: { dbSize: metrics.redis.dbSize }
    }));
  } else if (metrics.redis.configured) {
    insights.push(insight({
      id: "redis-ok",
      title: "Redis متصل",
      message: "Redis متاح لمساعد المراقبة. hit-rate يحتاج قراءة من لوحة Upstash نفسها.",
      severity: "success",
      impact: "يساعد في تقليل ضغط البحث والواجهات الثقيلة.",
      recommendation: "راقب hit rate والـ evictions من Upstash، واستهدف hit-rate أعلى من 80% للواجهات العامة.",
      evidence: { dbSize: metrics.redis.dbSize, infoAvailable: metrics.redis.infoAvailable }
    }));
  }

  if (dbUsageRate >= 70) {
    insights.push(insight({
      id: "db-connections-high",
      title: "ضغط اتصالات قاعدة البيانات مرتفع",
      message: `استخدام الاتصالات ${metrics.dbConnections.used}/${metrics.dbConnections.max} (${dbUsageRate}%).`,
      severity: "critical",
      impact: "قد تظهر timeouts وفشل checkout والبحث عند زيادة الحمل.",
      recommendation: "فعّل pooler، واضبط DB_POOL_MAX=3 على Vercel، وراقب pg_stat_activity.",
      evidence: metrics.dbConnections
    }));
  } else if (dbUsageRate >= 45) {
    insights.push(insight({
      id: "db-connections-watch",
      title: "اتصالات قاعدة البيانات تحتاج متابعة",
      message: `استخدام الاتصالات ${dbUsageRate}%، ليس حرجاً لكنه قابل للارتفاع عند حمل مفاجئ.`,
      severity: "warning",
      impact: "قد يصبح عنق زجاجة مع SSR وواجهات البحث.",
      recommendation: "راقب الاتصالات أثناء k6، وفعّل pooling قبل الإطلاق الكبير.",
      evidence: metrics.dbConnections
    }));
  }

  if (orderGrowth >= 40 && metrics.ordersLast24h >= 5) {
    insights.push(insight({
      id: "checkout-growth",
      title: "طلبات checkout زادت بوضوح",
      message: `طلبات آخر 24 ساعة زادت ${orderGrowth}% مقارنة باليوم السابق.`,
      severity: "warning",
      impact: "زيادة الطلبات قد تضغط المخزون والدفع والتنبيهات.",
      recommendation: "راقب failed jobs والمدفوعات المعلقة والمخزون المنخفض خلال نفس الفترة.",
      evidence: { ordersLast24h: metrics.ordersLast24h, ordersPrevious24h: metrics.ordersPrevious24h, orderGrowth }
    }));
  }

  if (searchGrowth >= 50 && metrics.searchLast24h >= 20) {
    insights.push(insight({
      id: "search-volume-growth",
      title: "استخدام البحث بدأ يرتفع",
      message: `عمليات البحث زادت ${searchGrowth}% في آخر 24 ساعة.`,
      severity: "info",
      impact: "ارتفاع البحث جيد تجارياً لكنه قد يضغط DB إذا كان Redis hit-rate منخفضاً.",
      recommendation: "راقب p95 للبحث وفعّل cache warm-up للكلمات الشائعة.",
      evidence: { searchLast24h: metrics.searchLast24h, searchPrevious24h: metrics.searchPrevious24h, searchGrowth }
    }));
  }

  if (zeroSearchRate >= 35 && metrics.searchLast24h >= 10) {
    insights.push(insight({
      id: "search-quality",
      title: "جودة نتائج البحث تحتاج تحسين",
      message: `${zeroSearchRate}% من عمليات البحث في آخر 24 ساعة بدون نتائج.`,
      severity: "warning",
      impact: "قد يشعر العميل أن المنتجات غير موجودة رغم توفرها بأسماء أخرى.",
      recommendation: "أضف مرادفات عربية/محلية، واربط البحث بالتصنيفات والمتغيرات، وراجع أكثر الاستعلامات بلا نتائج.",
      evidence: { zeroResultSearchLast24h: metrics.zeroResultSearchLast24h, searchLast24h: metrics.searchLast24h, zeroSearchRate }
    }));
  }

  if (metrics.failedJobs > 0 || metrics.queueLag > 20) {
    insights.push(insight({
      id: "queue-health",
      title: "طابور الخلفية يحتاج انتباه",
      message: `Jobs فاشلة: ${metrics.failedJobs}، وظائف متأخرة/قيد المعالجة: ${metrics.queueLag}.`,
      severity: metrics.failedJobs ? "critical" : "warning",
      impact: "قد تتأخر التنبيهات والولاء والرسائل الخارجية.",
      recommendation: "شغّل jobs:process أو راقب Vercel Cron، وافتح Queue Dashboard لمعالجة الفشل.",
      evidence: { failedJobs: metrics.failedJobs, queueLag: metrics.queueLag }
    }));
  }

  if (metrics.productsMissingImages > 0) {
    insights.push(insight({
      id: "missing-product-images",
      title: "هناك منتجات بدون صور",
      message: `${metrics.productsMissingImages} منتج نشط لا يملك صورة رئيسية.`,
      severity: "warning",
      impact: "يضعف المظهر ومعدل التحويل، خصوصاً في واجهة المتاجر والبحث.",
      recommendation: "اطلب من التجار رفع صور، أو استخدم صور افتراضية حسب الجناح/النشاط.",
      evidence: { count: metrics.productsMissingImages, topStores: metrics.topStoresMissingImages }
    }));
  }

  if (metrics.pendingReceipts > 0) {
    insights.push(insight({ id: "pending-receipts", title: "إثباتات دفع تنتظر مراجعة", message: `${metrics.pendingReceipts} إثبات دفع بانتظار التاجر.`, severity: "warning", impact: "قد تتأخر الطلبات والدفع.", recommendation: "نبّه التجار أو راقب لوحة الإيصالات.", evidence: { pendingReceipts: metrics.pendingReceipts } }));
  }
  if (metrics.openReturns > 0) {
    insights.push(insight({ id: "open-returns", title: "طلبات إرجاع مفتوحة", message: `${metrics.openReturns} طلب إرجاع/استرداد مفتوح.`, severity: "info", impact: "قد يؤثر على رضا العملاء والتسويات.", recommendation: "راجع المرتجعات المفتوحة قبل نهاية اليوم.", evidence: { openReturns: metrics.openReturns } }));
  }
  if (metrics.pendingMerchantApplications || metrics.pendingAds || metrics.pendingStoreOffers) {
    insights.push(insight({ id: "admin-review-queue", title: "قوائم مراجعة إدارية", message: `طلبات متاجر: ${metrics.pendingMerchantApplications}، إعلانات: ${metrics.pendingAds}، عروض: ${metrics.pendingStoreOffers}.`, severity: "info", impact: "تراكم المراجعات يؤخر نمو المنصة وإيرادات الإعلانات.", recommendation: "قسّم قائمة المراجعة يومياً حسب الأولوية والجاهزية.", evidence: { pendingMerchantApplications: metrics.pendingMerchantApplications, pendingAds: metrics.pendingAds, pendingStoreOffers: metrics.pendingStoreOffers } }));
  }

  if (!insights.some((item) => item.severity === "critical" || item.severity === "warning")) {
    insights.push(insight({ id: "platform-stable", title: "وضع المنصة مستقر حالياً", message: "لا توجد مؤشرات حرجة ظاهرة من القياسات المتاحة حالياً.", severity: "success", impact: "يمكن مواصلة المراقبة الدورية.", recommendation: "استمر في تتبع p95 للبحث وcheckout وRedis hit-rate من مزود الخدمة.", evidence: { readinessScore: readiness.score } }));
  }

  const score = Math.max(0, Math.min(100, 100 - insights.filter((item) => item.severity === "critical").length * 20 - insights.filter((item) => item.severity === "warning").length * 8));
  return { score, generatedAt: new Date().toISOString(), metrics, insights };
}
