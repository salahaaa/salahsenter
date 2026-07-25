type LogLevel = "info" | "warn" | "error";

type LogEvent = {
  event: string;
  level?: LogLevel;
  message?: string;
  data?: Record<string, unknown>;
  error?: unknown;
};

function serializeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { message: String(error) };
}

export function logEvent(input: LogEvent) {
  const level = input.level || "info";
  const payload = {
    ts: new Date().toISOString(),
    event: input.event,
    message: input.message,
    data: input.data || {},
    error: serializeError(input.error)
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export async function measureAsync<T>(event: string, fn: () => Promise<T>, data: Record<string, unknown> = {}) {
  const start = Date.now();
  try {
    const result = await fn();
    logEvent({ event, data: { ...data, durationMs: Date.now() - start, ok: true } });
    return result;
  } catch (error) {
    logEvent({ level: "error", event, data: { ...data, durationMs: Date.now() - start, ok: false }, error });
    throw error;
  }
}
