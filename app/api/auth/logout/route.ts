export const dynamic = "force-dynamic";

import { revokeCurrentSession } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST() {
  await revokeCurrentSession();
  return ok({ message: "تم تسجيل الخروج" });
}
