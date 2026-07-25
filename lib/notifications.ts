import { eq } from "drizzle-orm";
import { db, notifications, roles, userRoles } from "@/lib/db";

export async function notifyAdmins(input: { title: string; body?: string; type: string; data?: Record<string, unknown> }) {
  const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, "super_admin")).limit(1);
  if (!adminRole) {
    await db.insert(notifications).values({ userId: null, storeId: null, title: input.title, body: input.body, type: input.type, data: input.data || {} });
    return;
  }
  const admins = await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, adminRole.id));
  if (!admins.length) {
    await db.insert(notifications).values({ userId: null, storeId: null, title: input.title, body: input.body, type: input.type, data: input.data || {} });
    return;
  }
  await db.insert(notifications).values(admins.map((admin) => ({ userId: admin.userId, storeId: null, title: input.title, body: input.body, type: input.type, data: input.data || {} })));
}
