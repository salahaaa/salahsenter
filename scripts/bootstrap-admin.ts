import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, roles, userRoles, users } from "@/lib/db";

function requireValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} مطلوب لإنشاء أول مسؤول.`);
  return value;
}

function assertSafeBootstrapEnvironment() {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("تم إيقاف bootstrap افتراضياً. عيّن ALLOW_ADMIN_BOOTSTRAP=true لتنفيذ العملية المقصودة.");
  }
  const email = requireValue("ADMIN_EMAIL").toLowerCase();
  const password = requireValue("ADMIN_PASSWORD");
  const fullName = requireValue("ADMIN_NAME");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("ADMIN_EMAIL غير صالح.");
  if (password.length < 16) throw new Error("ADMIN_PASSWORD يجب أن يكون 16 حرفاً على الأقل ولا يجوز استخدام كلمة مرور تجريبية.");
  if (/demo|example|change.?me|replace/i.test(password)) throw new Error("ADMIN_PASSWORD يبدو قيمة افتراضية أو تجريبية وغير مسموح به.");
  return { email, password, fullName };
}

async function main() {
  const { email, password, fullName } = assertSafeBootstrapEnvironment();
  const [superAdminRole] = await db.select().from(roles).where(eq(roles.code, "super_admin")).limit(1);
  if (!superAdminRole) throw new Error("دور super_admin غير موجود. نفذ migration history المعتمد أولاً.");

  const existingSuperAdmin = await db
    .select({ id: users.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(roles.code, "super_admin"), eq(users.status, "active")))
    .limit(1);
  if (existingSuperAdmin.length) throw new Error("يوجد مسؤول نشط بالفعل؛ bootstrap مسموح فقط عند تهيئة النظام لأول مرة.");

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) throw new Error("البريد المحدد موجود بالفعل. راجع الحساب يدويًا بدل منح صلاحية إدارة تلقائيًا.");

  await db.transaction(async (tx) => {
    const [admin] = await tx
      .insert(users)
      .values({
        fullName,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        status: "active",
        emailVerifiedAt: new Date(),
        mustChangePassword: true
      })
      .returning({ id: users.id });
    await tx.insert(userRoles).values({ userId: admin.id, roleId: superAdminRole.id });
  });

  console.log("ADMIN_BOOTSTRAP_COMPLETED");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
