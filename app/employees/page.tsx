import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { Permission, userHasPermission } from "@/lib/rbac";

/** Canonical short route requested by operations; routes to the caller's own panel. */
export default async function EmployeesShortcutPage() {
  const session = await requireAuth();
  if (await userHasPermission(session.userId, Permission.AdminAccess)) redirect("/admin/employees");
  if (session.roles.some((role) => role.scope === "store" || role.code === "merchant" || role.code === "store_employee")) redirect("/merchant/employees");
  redirect("/");
}
