export const dynamic = "force-dynamic";

import { ok } from "@/lib/api";
import { getCurrentSessionFresh } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentSessionFresh();
  if (!session) return ok({ session: null });
  return ok({
    session: {
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      isAdmin: session.roles.some((role) => role.code === "super_admin"),
      isMerchant: session.roles.some((role) => role.scope === "store" || ["merchant", "store_employee"].includes(role.code))
    }
  });
}
