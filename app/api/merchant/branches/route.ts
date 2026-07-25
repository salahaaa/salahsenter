export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { branchRentSummary, createMerchantBranch, listMerchantBranches } from "@/lib/enterprise/store-branches";

const schema = z.object({
  branchName: z.string().min(2).max(180),
  countryId: z.string().uuid().optional().nullable(),
  governorateId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid().optional().nullable(),
  districtId: z.string().uuid().optional().nullable(),
  address: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  primaryWingId: z.string().uuid().optional().nullable(),
  rentAmount: z.coerce.number().min(0).optional(),
  rentCurrency: z.string().max(10).optional(),
  rentCycle: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).optional(),
  notes: z.string().optional()
});

export async function GET() {
  try {
    const session = await requireAuth();
    const data = await listMerchantBranches(session.userId);
    const rent = await branchRentSummary(session.userId);
    return ok({ ...data, rent });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المحلات والفروع");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const result = await createMerchantBranch(session.userId, payload);
    return created({ ...result, message: "تم إنشاء طلب فتح محل/فرع إضافي وربطه بنفس حساب التاجر" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء طلب الفرع");
  }
}
