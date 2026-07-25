export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, tenantBilling, tenantDomains, tenantStores, tenantUsers, tenants } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ name: z.string().min(2), slug: z.string().optional(), plan: z.enum(["starter", "professional", "business", "enterprise"]).default("starter"), domain: z.string().trim().min(3).max(255).optional(), ownerUserId: z.string().uuid().optional().nullable(), primaryStoreId: z.string().uuid().optional().nullable(), isWhiteLabel: z.boolean().default(false) });

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "tenants.manage");
    const rows = await db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(200);
    return ok({ tenants: rows });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المستأجرين");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "tenants.manage");
    const payload = schema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({ name: payload.name, slug: payload.slug || slugify(payload.name), plan: payload.plan, ownerUserId: payload.ownerUserId || null, primaryStoreId: payload.primaryStoreId || null, isWhiteLabel: payload.isWhiteLabel }).returning();
      await tx.insert(tenantBilling).values({ tenantId: tenant.id, plan: payload.plan, billingStatus: "trial" });
      if (payload.ownerUserId) await tx.insert(tenantUsers).values({ tenantId: tenant.id, userId: payload.ownerUserId, role: "owner", status: "active" }).onConflictDoNothing();
      if (payload.primaryStoreId) await tx.insert(tenantStores).values({ tenantId: tenant.id, storeId: payload.primaryStoreId }).onConflictDoNothing();
      const [domain] = payload.domain ? await tx.insert(tenantDomains).values({ tenantId: tenant.id, domain: payload.domain.toLowerCase(), type: payload.domain.includes(".") ? "custom_domain" : "subdomain", verificationToken: `tdv_${crypto.randomBytes(18).toString("base64url")}` }).returning() : [null];
      return { tenant, domain };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "tenant", entityId: result.tenant.id, afterData: result });
    return created({ ...result, message: "تم إنشاء المستأجر؛ لا تفعّل الدومين قبل وضع رمز التحقق وإتمام التحقق التشغيلي" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء المستأجر");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "tenants.manage");
    const payload = z.object({ id: z.string(), status: z.enum(["active", "pending", "suspended", "closed"]), plan: z.enum(["starter", "professional", "business", "enterprise"]).optional() }).parse(await request.json());
    const [tenant] = await db.update(tenants).set({ status: payload.status, plan: payload.plan || undefined, updatedAt: new Date() }).where(eq(tenants.id, payload.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "status_change", entityType: "tenant", entityId: payload.id, afterData: tenant });
    return ok({ tenant, message: "تم تحديث المستأجر" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث المستأجر");
  }
}
