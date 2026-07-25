import { getRedisConfig, redisPipeline } from "@/lib/redis/client";

export type RequestTrafficSnapshot = {
  configured: boolean;
  sampleRate: number;
  requestsLast5m: number;
  requestsLast1h: number;
  apiRequestsLast5m: number;
  apiRequestsLast1h: number;
  buckets: Array<{ minute: string; total: number; api: number }>;
};

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sampleRate() {
  return Math.max(0.01, Math.min(1, envNumber("MONITORING_REQUEST_SAMPLE_RATE", 1)));
}

function minuteBucket(date = new Date()) {
  return date.toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

function bucketDate(offsetMinutes: number) {
  return new Date(Date.now() - offsetMinutes * 60 * 1000);
}

function requestKey(bucket: string, kind: "total" | "api") {
  return `obs:req:${bucket}:${kind}`;
}

export async function recordRequestMetric(input: { pathname: string; method: string }) {
  const config = getRedisConfig();
  if (config.backend === "unconfigured") return;
  const rate = sampleRate();
  if (rate < 1 && Math.random() > rate) return;
  const weight = Math.max(1, Math.round(1 / rate));
  const bucket = minuteBucket();
  const keys = [requestKey(bucket, "total")];
  if (input.pathname.startsWith("/api/")) keys.push(requestKey(bucket, "api"));

  const commands: unknown[][] = [];
  for (const key of keys) {
    commands.push(["INCRBY", key, weight]);
    commands.push(["EXPIRE", key, 2 * 60 * 60]);
  }
  await redisPipeline(commands, { context: "observability request metric", optional: true }).catch(() => undefined);
}

export async function getRequestTrafficSnapshot(minutes = 60): Promise<RequestTrafficSnapshot> {
  const config = getRedisConfig();
  const cleanMinutes = Math.max(5, Math.min(120, Math.floor(minutes)));
  const buckets = Array.from({ length: cleanMinutes }, (_, index) => minuteBucket(bucketDate(cleanMinutes - index - 1)));
  if (config.backend === "unconfigured") {
    return { configured: false, sampleRate: sampleRate(), requestsLast5m: 0, requestsLast1h: 0, apiRequestsLast5m: 0, apiRequestsLast1h: 0, buckets: buckets.map((minute) => ({ minute, total: 0, api: 0 })) };
  }

  const commands = buckets.flatMap((bucket) => [["GET", requestKey(bucket, "total")], ["GET", requestKey(bucket, "api")]]);
  const result = await redisPipeline<string | number | null>(commands, { context: "observability request metric read", optional: true }).catch(() => []);
  const rows = buckets.map((bucket, index) => {
    const total = Number(result[index * 2]?.result || 0);
    const api = Number(result[index * 2 + 1]?.result || 0);
    return { minute: bucket, total, api };
  });
  const last5 = rows.slice(-5);
  return {
    configured: true,
    sampleRate: sampleRate(),
    requestsLast5m: last5.reduce((sum, item) => sum + item.total, 0),
    requestsLast1h: rows.reduce((sum, item) => sum + item.total, 0),
    apiRequestsLast5m: last5.reduce((sum, item) => sum + item.api, 0),
    apiRequestsLast1h: rows.reduce((sum, item) => sum + item.api, 0),
    buckets: rows
  };
}
