export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { created, fail, handleApiError } from "@/lib/api";
import { createSessionForUser, hashPassword } from "@/lib/auth";
import { db, roles, userRoles, users } from "@/lib/db";
import { registerSchema } from "@/lib/validators";
import { getPlatformSecuritySettings, isPlatformLocked } from "@/lib/security-settings";
import { checkIpRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const security = await getPlatformSecuritySettings();
    if (isPlatformLocked(security) || security.disabledModules.registrations) return fail("التسجيلات الجديدة متوقفة مؤقتاً", 503);
    const rate = await checkIpRateLimit("auth:register", 5, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقاً", 429);
    const payload = registerSchema.parse(await request.json());
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, payload.email.toLowerCase())).limit(1);
    if (existingUser) return fail("البريد الإلكتروني مستخدم مسبقاً", 409);
    const [customerRole] = await db.select().from(roles).where(eq(roles.code, "customer")).limit(1);
    if (!customerRole) return fail("أدوار النظام غير مهيأة. نفذ npm run db:seed أولاً", 500);

    const [user] = await db
      .insert(users)
      .values({
        fullName: payload.fullName,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        passwordHash: await hashPassword(payload.password),
        status: "active"
      })
      .returning();

    await db.insert(userRoles).values({ userId: user.id, roleId: customerRole.id });
    const session = await createSessionForUser(user.id);

    return created({ user: { id: user.id, fullName: user.fullName, email: user.email }, session });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء الحساب");
  }
}
