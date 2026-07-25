import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, permissions, platformEmployees, rolePermissions, roles, storeEmployees, userPermissions, userRoles, users } from "@/lib/db";
import { normalizePermissionOverrides, type PermissionOverrideEffect, type PermissionPresentationState } from "@/lib/employees/policy";
import { filterPlatformPermissionCodes, filterStorePermissionCodes, isPlatformPermission, isStorePermission } from "@/lib/permission-scopes";

export type PermissionManagementDomain = "platform" | "store";
export type PermissionOverrideInput = { code: string; effect: PermissionPresentationState };

export type PermissionManagementEmployee = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  status: string;
  groupRoleId: string | null;
  inheritedPermissionCodes: string[];
  overrides: Record<string, PermissionOverrideEffect>;
};

export type PermissionManagementRole = { id: string; name: string; description: string | null };
export type PermissionManagementPermission = { id: string; code: string; name: string; group: string; description: string | null };

function rolePermissionMap(rows: Array<{ roleId: string; code: string }>) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const current = result.get(row.roleId) || [];
    current.push(row.code);
    result.set(row.roleId, current);
  }
  return result;
}

function overridesByUser(rows: Array<{ userId: string; code: string; effect: "grant" | "deny" }>) {
  const result = new Map<string, Record<string, PermissionOverrideEffect>>();
  for (const row of rows) {
    result.set(row.userId, { ...(result.get(row.userId) || {}), [row.code]: row.effect });
  }
  return result;
}

export async function loadPlatformPermissionManagement() {
  const [employeeRows, permissionRows, groupRows] = await Promise.all([
    db
      .select({
        id: platformEmployees.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        username: users.username,
        avatarUrl: users.avatarUrl,
        jobTitle: platformEmployees.jobTitle,
        status: platformEmployees.status,
        groupRoleId: platformEmployees.groupRoleId
      })
      .from(platformEmployees)
      .innerJoin(users, eq(platformEmployees.userId, users.id))
      .orderBy(asc(users.fullName)),
    db.select({ id: permissions.id, code: permissions.code, name: permissions.name, group: permissions.group, description: permissions.description }).from(permissions).orderBy(asc(permissions.group), asc(permissions.code)),
    db
      .select({ id: roles.id, name: roles.name, description: roles.description, code: roles.code })
      .from(roles)
      .where(and(eq(roles.scope, "system"), eq(roles.isSystem, false)))
      .orderBy(asc(roles.name))
  ]);
  const userIds = employeeRows.map((employee) => employee.userId);
  const [assignmentRows, overrideRows] = userIds.length
    ? await Promise.all([
        db
          .select({ userId: userRoles.userId, roleId: userRoles.roleId })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(and(inArray(userRoles.userId, userIds), eq(roles.scope, "system"), isNull(userRoles.storeId))),
        db
          .select({ userId: userPermissions.userId, code: permissions.code, effect: userPermissions.effect })
          .from(userPermissions)
          .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
          .where(and(inArray(userPermissions.userId, userIds), isNull(userPermissions.storeId)))
      ])
    : [[], []];
  const roleIds = [...new Set(assignmentRows.map((row) => row.roleId))];
  const permissionAssignments = roleIds.length
    ? await db
        .select({ roleId: rolePermissions.roleId, code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(inArray(rolePermissions.roleId, roleIds))
    : [];
  const permissionsForRole = rolePermissionMap(permissionAssignments);
  const roleIdsForUser = new Map<string, string[]>();
  for (const row of assignmentRows) roleIdsForUser.set(row.userId, [...(roleIdsForUser.get(row.userId) || []), row.roleId]);
  const overrides = overridesByUser(overrideRows);
  const employees: PermissionManagementEmployee[] = employeeRows.map((employee) => ({
    ...employee,
    inheritedPermissionCodes: filterPlatformPermissionCodes((roleIdsForUser.get(employee.userId) || []).flatMap((roleId) => permissionsForRole.get(roleId) || [])),
    overrides: overrides.get(employee.userId) || {}
  }));

  return {
    employees,
    permissions: permissionRows.filter((permission) => isPlatformPermission(permission.code)),
    groups: groupRows
      .filter((role) => role.code !== "super_admin" && !role.code.startsWith("platform_employee_"))
      .map(({ id, name, description }) => ({ id, name, description }))
  };
}

export async function loadStorePermissionManagement(storeId: string) {
  const [employeeRows, permissionRows, groupRows] = await Promise.all([
    db
      .select({
        id: storeEmployees.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        username: users.username,
        avatarUrl: users.avatarUrl,
        jobTitle: storeEmployees.jobTitle,
        status: storeEmployees.status,
        groupRoleId: storeEmployees.groupRoleId
      })
      .from(storeEmployees)
      .innerJoin(users, eq(storeEmployees.userId, users.id))
      .where(eq(storeEmployees.storeId, storeId))
      .orderBy(asc(users.fullName)),
    db.select({ id: permissions.id, code: permissions.code, name: permissions.name, group: permissions.group, description: permissions.description }).from(permissions).orderBy(asc(permissions.group), asc(permissions.code)),
    db
      .select({ id: roles.id, name: roles.name, description: roles.description, code: roles.code })
      .from(roles)
      .where(eq(roles.scope, "store"))
      .orderBy(asc(roles.name))
  ]);
  const groupPrefix = `store_group_${storeId.replace(/-/g, "").slice(0, 12)}_`;
  // Only merchant-created group roles are selectable; each employee's private
  // identity role remains an implementation detail and is never assignable.
  const employeeGroups = groupRows.filter((role) => role.code.startsWith(groupPrefix)).map(({ id, name, description }) => ({ id, name, description }));

  const userIds = employeeRows.map((employee) => employee.userId);
  const [assignmentRows, overrideRows] = userIds.length
    ? await Promise.all([
        db.select({ userId: userRoles.userId, roleId: userRoles.roleId }).from(userRoles).where(and(inArray(userRoles.userId, userIds), eq(userRoles.storeId, storeId))),
        db
          .select({ userId: userPermissions.userId, code: permissions.code, effect: userPermissions.effect })
          .from(userPermissions)
          .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
          .where(and(inArray(userPermissions.userId, userIds), eq(userPermissions.storeId, storeId)))
      ])
    : [[], []];
  const roleIds = [...new Set(assignmentRows.map((row) => row.roleId))];
  const permissionAssignments = roleIds.length
    ? await db
        .select({ roleId: rolePermissions.roleId, code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(inArray(rolePermissions.roleId, roleIds))
    : [];
  const permissionsForRole = rolePermissionMap(permissionAssignments);
  const roleIdsForUser = new Map<string, string[]>();
  for (const row of assignmentRows) roleIdsForUser.set(row.userId, [...(roleIdsForUser.get(row.userId) || []), row.roleId]);
  const overrides = overridesByUser(overrideRows);
  const employees: PermissionManagementEmployee[] = employeeRows.map((employee) => ({
    ...employee,
    inheritedPermissionCodes: filterStorePermissionCodes((roleIdsForUser.get(employee.userId) || []).flatMap((roleId) => permissionsForRole.get(roleId) || [])),
    overrides: overrides.get(employee.userId) || {}
  }));

  return {
    employees,
    permissions: permissionRows.filter((permission) => isStorePermission(permission.code)),
    groups: employeeGroups
  };
}

export async function replaceUserPermissionOverrides(input: {
  userId: string;
  storeId: string | null;
  domain: PermissionManagementDomain;
  overrides: PermissionOverrideInput[];
  actorId: string;
  tx?: typeof db;
}) {
  const executor = input.tx || db;
  const normalized = normalizePermissionOverrides(input.overrides);
  const allowedCodes = input.domain === "platform"
    ? filterPlatformPermissionCodes(normalized.map((item) => item.code))
    : filterStorePermissionCodes(normalized.map((item) => item.code));
  const rows = allowedCodes.length
    ? await executor.select({ id: permissions.id, code: permissions.code }).from(permissions).where(inArray(permissions.code, allowedCodes))
    : [];
  const valid = new Map(rows.map((row) => [row.code, row.id]));
  if (allowedCodes.length !== normalized.length || valid.size !== allowedCodes.length) {
    throw new Error("توجد صلاحية غير معروفة أو خارج نطاق هذه اللوحة");
  }

  await executor.delete(userPermissions).where(and(eq(userPermissions.userId, input.userId), input.storeId ? eq(userPermissions.storeId, input.storeId) : isNull(userPermissions.storeId)));
  if (normalized.length) {
    await executor.insert(userPermissions).values(normalized.map((item) => ({
      userId: input.userId,
      permissionId: valid.get(item.code)!,
      storeId: input.storeId,
      effect: item.effect,
      createdBy: input.actorId,
      updatedAt: new Date()
    })));
  }
  return normalized;
}
