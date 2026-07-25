export type SecuritySeverity = "success" | "info" | "warning" | "critical";

export type RootCauseInput = {
  service?: string;
  title?: string;
  message?: string;
  stackTrace?: string;
  logs?: string[];
  deployment?: {
    commitSha?: string;
    branch?: string;
    environment?: string;
    deployedAt?: string;
  };
  relatedServices?: string[];
};

export type RootCauseAnalysis = {
  category: string;
  severity: Exclude<SecuritySeverity, "success">;
  likelyCause: string;
  expectedFile?: string;
  affectedService: string;
  confidence: number;
  evidence: string[];
  recommendation: string;
  relatedServices: string[];
  deployment?: RootCauseInput["deployment"];
};

const FILE_RE = /(?:at\s+)?(?:webpack-internal:\/\/\/)?(?:\.?\.?\/)?([\w@./-]+\.(?:ts|tsx|js|mjs|cjs))(?:[:)]|:\d+:\d+)?/g;

type Rule = {
  category: string;
  severity: Exclude<SecuritySeverity, "success">;
  service: string;
  keywords: RegExp[];
  cause: string;
  recommendation: string;
  confidence: number;
};

const rules: Rule[] = [
  {
    category: "database_failure",
    severity: "critical",
    service: "database",
    keywords: [/postgres/i, /database/i, /ECONNREFUSED/i, /connection.*terminated/i, /too many connections/i, /deadlock/i, /transaction/i, /pg_stat/i],
    cause: "خلل أو ضغط في قاعدة البيانات/الاتصالات أو تعارض معاملات.",
    recommendation: "افحص pg_stat_activity، فعّل pooler، راجع آخر query بطيء، وأعد المحاولة للمعاملات الفاشلة بعد التأكد من idempotency.",
    confidence: 0.88
  },
  {
    category: "redis_disconnect",
    severity: "warning",
    service: "redis",
    keywords: [/redis/i, /upstash/i, /rate limit/i, /cache/i, /DBSIZE/i, /pipeline/i],
    cause: "Redis غير متصل أو مفاتيح الكاش/الـ rate limit تتعطل.",
    recommendation: "تحقق من UPSTASH_REDIS_REST_URL/TOKEN، امسح الكاش عند الضرورة، وراقب hit-rate والـ evictions.",
    confidence: 0.84
  },
  {
    category: "auth_or_permission",
    severity: "critical",
    service: "authentication",
    keywords: [/jwt/i, /session/i, /unauthori[sz]ed/i, /permission/i, /csrf/i, /role/i, /rbac/i, /forbidden/i],
    cause: "خلل في المصادقة أو الصلاحيات أو CSRF/RBAC.",
    recommendation: "راجع middleware و assertAdmin/assertMerchant، تأكد من JWT_SECRET و CSRF header، وافحص سجل التدقيق للحسابات المتأثرة.",
    confidence: 0.86
  },
  {
    category: "upload_storage_failure",
    severity: "warning",
    service: "uploads",
    keywords: [/cloudinary/i, /upload/i, /media/i, /image/i, /base64/i, /FormData/i, /Blob/i],
    cause: "مشكلة في خدمة الرفع/Cloudinary أو ملف غير مقبول.",
    recommendation: "تحقق من Cloudinary env، حجم الملف، نوع MIME، وعدم حفظ data:image داخل قاعدة البيانات.",
    confidence: 0.8
  },
  {
    category: "queue_failure",
    severity: "warning",
    service: "queue_jobs",
    keywords: [/background_jobs/i, /queue/i, /cron/i, /locked/i, /retry/i, /job/i],
    cause: "وظائف الخلفية متأخرة/عالقة أو Cron لا يعالج الطابور.",
    recommendation: "شغّل jobs:process أو راقب Vercel Cron، حرر jobs العالقة، ثم أعد المحاولة للوظائف الفاشلة.",
    confidence: 0.82
  },
  {
    category: "memory_pressure",
    severity: "critical",
    service: "runtime",
    keywords: [/heap/i, /out of memory/i, /memory leak/i, /SIGKILL/i, /SIGABRT/i, /allocation failed/i],
    cause: "ضغط ذاكرة أو تسريب محتمل في runtime/build.",
    recommendation: "راجع العمليات الثقيلة، قلل payloads والصور inline، اضبط NODE_OPTIONS=--max_old_space_size=4096 للـ build، وراقب heapUsed/heapTotal.",
    confidence: 0.9
  },
  {
    category: "api_performance",
    severity: "warning",
    service: "apis",
    keywords: [/timeout/i, /slow/i, /latency/i, /p95/i, /response time/i, /fetch failed/i, /500/i],
    cause: "بطء أو فشل في API نتيجة DB/Redis أو معالجة زائدة.",
    recommendation: "افحص p95، أضف كاش أو pagination، راجع query plans، وفعّل التنبيهات عند تجاوز thresholds.",
    confidence: 0.76
  },
  {
    category: "security_threat",
    severity: "critical",
    service: "security",
    keywords: [/brute force/i, /attack/i, /suspicious/i, /sql injection/i, /xss/i, /abuse/i, /spam/i, /escalation/i],
    cause: "نشاط أمني مشبوه أو محاولة استغلال.",
    recommendation: "فعّل مراقبة مشددة، راجع IP والـ user agent، ارفع rate limiting، وأنشئ Incident حتى انتهاء التحقيق.",
    confidence: 0.87
  }
];

function compactText(input: RootCauseInput) {
  return [input.service, input.title, input.message, input.stackTrace, ...(input.logs || [])].filter(Boolean).join("\n").slice(0, 20_000);
}

function extractFiles(text: string) {
  const files = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = FILE_RE.exec(text))) {
    const file = match[1]?.replace(/^webpack-internal:\/\/\//, "");
    if (!file || file.includes("node_modules")) continue;
    files.set(file, (files.get(file) || 0) + 1);
  }
  return [...files.entries()].sort((a, b) => b[1] - a[1]).map(([file]) => file);
}

export function analyzeRootCause(input: RootCauseInput): RootCauseAnalysis {
  const text = compactText(input);
  const matched = rules
    .map((rule) => ({ rule, hits: rule.keywords.reduce((count, re) => count + (re.test(text) ? 1 : 0), 0) }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits * b.rule.confidence - a.hits * a.rule.confidence)[0];

  const files = extractFiles(text);
  const relatedServices = [...new Set([...(input.relatedServices || []), input.service, matched?.rule.service].filter(Boolean) as string[])];

  if (matched) {
    return {
      category: matched.rule.category,
      severity: matched.rule.severity,
      likelyCause: matched.rule.cause,
      expectedFile: files[0],
      affectedService: input.service || matched.rule.service,
      confidence: Math.min(0.98, matched.rule.confidence + Math.max(0, matched.hits - 1) * 0.03),
      evidence: [
        `matched_keywords=${matched.hits}`,
        files[0] ? `top_file=${files[0]}` : "no_file_in_trace",
        input.deployment?.commitSha ? `commit=${input.deployment.commitSha}` : "commit_unknown"
      ],
      recommendation: matched.rule.recommendation,
      relatedServices,
      deployment: input.deployment
    };
  }

  return {
    category: "unknown_runtime_issue",
    severity: "warning",
    likelyCause: "المعطيات غير كافية لتحديد سبب واحد؛ قد تكون المشكلة مرتبطة بتغيير حديث أو خدمة خارجية.",
    expectedFile: files[0],
    affectedService: input.service || "platform",
    confidence: files[0] ? 0.55 : 0.35,
    evidence: [files[0] ? `top_file=${files[0]}` : "no_stack_file", input.deployment?.commitSha ? `commit=${input.deployment.commitSha}` : "commit_unknown"],
    recommendation: "اربط الخطأ بـ correlationId، راجع آخر deployment والمتغيرات البيئية، ثم أعد تشغيل الفحص بعد تجميع logs أكثر.",
    relatedServices,
    deployment: input.deployment
  };
}

export function deploymentMetadata() {
  return {
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA,
    branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_PUBLIC_VERCEL_ENV
  };
}
