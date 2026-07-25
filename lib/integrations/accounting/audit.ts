import { headers } from "next/headers";
import { db, integrationAuditLogs } from "@/lib/db";
import type { IntegrationAuthContext } from "@/lib/integrations/accounting/auth";

export async function writeIntegrationAudit(input: {
  context?: IntegrationAuthContext | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  storeId?: string | null;
  status?: "success" | "failed" | "accepted" | "rejected";
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const h = await headers().catch(() => null as any);
    await db.insert(integrationAuditLogs).values({
      clientKey: input.context?.clientId || null,
      storeId: input.storeId || null,
      action: input.action,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      status: input.status || "success",
      requestId: input.requestId || h?.get?.("x-request-id") || h?.get?.("x-vercel-id") || null,
      ipAddress: h?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || h?.get?.("x-real-ip") || null,
      userAgent: h?.get?.("user-agent") || null,
      metadata: input.metadata || {}
    });
  } catch (error) {
    console.error("integration audit log failed", error);
  }
}
