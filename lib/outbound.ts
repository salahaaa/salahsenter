export type OutboundChannel = "email" | "sms" | "whatsapp";

type OutboundInput = { channel: OutboundChannel; to: string; subject?: string; message: string; template?: string; data?: Record<string, unknown> };

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.NEXT_PUBLIC_APP_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function timeoutMs() {
  const value = Number(process.env.OUTBOUND_WEBHOOK_TIMEOUT_MS || 10_000);
  return Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1_000), 30_000) : 10_000;
}

function isEnabled(kind: string) {
  return process.env[`${kind}_NOTIFICATIONS_ENABLED`] === "true" || process.env[`${kind}_WEBHOOK_ENABLED`] === "true";
}

function safeDeliveryMetadata(input: OutboundInput) {
  return { channel: input.channel, template: input.template || null, hasSubject: Boolean(input.subject), messageBytes: Buffer.byteLength(input.message, "utf8") };
}

export async function sendOptionalActivationMessages(input: { email: string; phone?: string | null; subject: string; message: string }) {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED === "true") {
    await sendTransactionalMessage({ channel: "email", to: input.email, subject: input.subject, message: input.message, template: "account_activation" });
  }
  if (process.env.SMS_NOTIFICATIONS_ENABLED === "true" && input.phone) {
    await sendTransactionalMessage({ channel: "sms", to: input.phone, message: input.message, template: "account_activation" });
  }
}

export async function sendTransactionalMessage(input: OutboundInput) {
  if (input.channel === "email") return sendWebhook("EMAIL", process.env.EMAIL_WEBHOOK_URL, process.env.EMAIL_WEBHOOK_TOKEN, input);
  if (input.channel === "sms") return sendWebhook("SMS", process.env.SMS_WEBHOOK_URL, process.env.SMS_WEBHOOK_TOKEN, input);
  return sendWebhook("WHATSAPP", process.env.WHATSAPP_WEBHOOK_URL, process.env.WHATSAPP_WEBHOOK_TOKEN, input);
}

async function sendWebhook(kind: string, url: string | undefined, token: string | undefined, input: OutboundInput) {
  if (!isEnabled(kind)) return { skipped: true, reason: "channel_disabled" };
  if (!url) {
    // Development can record a redacted delivery intent. Production must fail
    // so the queue retries and the release gate clearly reports misconfiguration.
    if (isProductionRuntime()) throw new Error(`${kind}_WEBHOOK_URL is required when ${kind} delivery is enabled`);
    console.warn(`${kind}_NOTIFICATION_UNCONFIGURED`, safeDeliveryMetadata(input));
    return { skipped: true, reason: "webhook_not_configured" };
  }

  let destination: URL;
  try {
    destination = new URL(url);
  } catch {
    throw new Error(`${kind}_WEBHOOK_URL is invalid`);
  }
  if (isProductionRuntime() && destination.protocol !== "https:") throw new Error(`${kind}_WEBHOOK_URL must use HTTPS in production`);

  let response: Response;
  try {
    response = await fetch(destination, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs())
    });
  } catch (error) {
    throw new Error(`${kind} webhook delivery failed: ${error instanceof Error ? error.message : "network_error"}`);
  }
  if (!response.ok) throw new Error(`${kind} webhook failed with ${response.status}`);
  return { delivered: true, status: response.status };
}
