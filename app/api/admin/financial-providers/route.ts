export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, financialProviders } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { financialProviderStatuses, financialProviderTypes } from "@/lib/financial/providers";

const schema = z.object({
  name: z.string().min(2).max(180),
  slug: z.string().optional(),
  type: z.enum(financialProviderTypes),
  status: z.enum(financialProviderStatuses).default("active"),
  logoUrl: z.string().optional().nullable(),
  countryCode: z.string().max(10).optional().nullable(),
  currencyCode: z.string().max(10).default("YER"),
  isEnabled: z.boolean().default(true),
  isVisibleToMerchants: z.boolean().default(true),
  supportsDeposits: z.boolean().default(true),
  supportsWithdrawals: z.boolean().default(false),
  supportsRefunds: z.boolean().default(false),
  supportsCOD: z.boolean().default(false),
  featureFlags: z.record(z.unknown()).default({}),
  sortOrder: z.coerce.number().int().default(0)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "providers.view");
    const providers = await db.select().from(financialProviders).orderBy(asc(financialProviders.sortOrder), asc(financialProviders.name));
    return ok({ providers });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مزودي الخدمات المالية");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "providers.add");
    const payload = schema.parse(await request.json());
    const [provider] = await db.insert(financialProviders).values({ ...payload, slug: payload.slug || slugify(payload.name) }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "financial_provider", entityId: provider.id, afterData: provider });
    return created({ provider, message: "تم إنشاء مزود مالي" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء مزود مالي");
  }
}
