export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { desc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, integrationMappingProfiles } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { createMappingProfile } from "@/lib/integrations/erp/admin-service";
import { ERP_ADAPTERS, getErpAdapter } from "@/lib/integrations/erp/abstraction";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  clientKey: z.string().min(3).max(120),
  storeId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(180),
  systemType: z.string().max(80).default("generic"),
  resource: z.enum(["products", "inventory", "orders", "invoices", "returns", "events"]),
  direction: z.enum(["local_to_platform", "platform_to_local", "bidirectional"]).default("bidirectional"),
  mapping: z.record(z.unknown()).optional(),
  sourceOfTruth: z.record(z.unknown()).default({}),
  conflictPolicy: z.record(z.unknown()).default({})
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    const profiles = await db.select().from(integrationMappingProfiles).orderBy(desc(integrationMappingProfiles.createdAt)).limit(200);
    return ok({ profiles, adapters: ERP_ADAPTERS });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل Mapping Profiles");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    const payload = schema.parse(await request.json());
    const adapter = getErpAdapter(payload.systemType);
    const profile = await createMappingProfile({ ...payload, mapping: payload.mapping || adapter.defaultMapping, createdBy: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "integration_mapping_profile", entityId: profile.id, afterData: profile });
    return created({ profile, message: "تم إنشاء Mapping Profile" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء Mapping Profile");
  }
}
