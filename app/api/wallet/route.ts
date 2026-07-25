export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getWalletDashboard, redeemPointsToWallet } from "@/lib/enterprise/wallet";

const redeemSchema = z.object({ mode: z.literal("redeem_points"), points: z.coerce.number().int().positive() });

export async function GET() {
  try {
    const session = await requireAuth();
    return ok(await getWalletDashboard(session.userId));
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المحفظة");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = redeemSchema.parse(await request.json());
    const wallet = await redeemPointsToWallet(session.userId, payload.points);
    return ok({ wallet, message: "تم استبدال النقاط إلى رصيد محفظة" });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ عملية المحفظة");
  }
}
