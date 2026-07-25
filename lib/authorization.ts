/**
 * Centralized Authorization Layer
 * ================================
 * Single source of truth for all access-control decisions across pages, route
 * handlers and server actions. No file should perform ad-hoc role checks
 * (`hasRole(session, ...)`, raw `userHasPermission`) directly — it must go
 * through one of the functions below.
 *
 * This module COMPOSES (does not duplicate) the primitives already living in
 * `lib/auth.ts` and `lib/rbac.ts`, preserving every existing behavior while
 * giving us one auditable choke point and richer domain guards (ownership,
 * order/product management, store-scoped access).
 *
 * Backward compatible: existing `requireAuth`, `assertAdmin`, `assertMerchant`
 * keep working — they are re-exported and internally routed through here.
 */

import { and, eq } from "drizzle-orm";
import {
  getCurrentSession,
  hasRole,
  hasStoreAccess,
  requireAuth as baseRequireAuth,
  type SessionPayload,
  type SessionRole
} from "@/lib/auth";
import {
  Permission,
  assertAdmin as baseAssertAdmin,
  assertMerchant as baseAssertMerchant,
  userHasStorePermission
} from "@/lib/rbac";
import { db, orders, productVariants, products, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export { Permission } from "@/lib/rbac";
export type { SessionPayload, SessionRole } from "@/lib/auth";

/** The canonical authorization error thrown/returned by every guard. */
export class AuthorizationError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

/* ------------------------------------------------------------------ *
 * Core session guards
 * ------------------------------------------------------------------ */

/** Require an authenticated, active session. Throws AuthorizationError(401). */
export async function requireAuth(): Promise<SessionPayload> {
  try {
    return await baseRequireAuth();
  } catch (error) {
    const message = error instanceof Error ? error.message : "يجب تسجيل الدخول أولاً";
    throw new AuthorizationError(message, message.includes("دخول") || message.includes("session") ? 401 : 403);
  }
}

/** Require an admin (optionally with a specific permission code). */
export async function requireAdmin(permissionCode: string = Permission.AdminAccess): Promise<SessionPayload> {
  const session = await requireAuth();
  await baseAssertAdmin(session, permissionCode as any);
  return session;
}

/** Require a merchant or store employee (or super_admin). */
export async function requireMerchant(): Promise<SessionPayload> {
  const session = await requireAuth();
  baseAssertMerchant(session);
  return session;
}

/* ------------------------------------------------------------------ *
 * Store-scoped access
 * ------------------------------------------------------------------ */

/**
 * Require access to a specific store. Returns the session when allowed.
 * Resolves the merchant's primary store when `storeId` is omitted (handy for
 * merchant routes that operate on "my store").
 */
export async function requireStoreAccess(
  storeId: string | null | undefined
): Promise<{ session: SessionPayload; storeId: string }> {
  const session = await requireMerchant();
  // super_admin bypasses store binding checks.
  if (hasRole(session, "super_admin")) {
    if (!storeId) {
      const store = await getMerchantPrimaryStore(session.userId);
      if (!store) throw new AuthorizationError("لا يوجد متجر مرتبط بحسابك", 404);
      return { session, storeId: store.id };
    }
    return { session, storeId };
  }

  const resolvedStoreId = storeId || (await getMerchantPrimaryStore(session.userId))?.id;
  if (!resolvedStoreId) throw new AuthorizationError("لا يوجد متجر مرتبط بحسابك", 404);
  if (!hasStoreAccess(session, resolvedStoreId)) {
    throw new AuthorizationError("لا تملك صلاحية الوصول إلى هذا المتجر", 403);
  }
  return { session, storeId: resolvedStoreId };
}

/** Require a fine-grained permission on a store (RBAC + scope check combined). */
export async function requireStorePermission(
  storeId: string,
  permissionCode: string = Permission.ManageStoreSettings
): Promise<SessionPayload> {
  const { session } = await requireStoreAccess(storeId);
  if (hasRole(session, "super_admin")) return session;
  const ok = await userHasStorePermission(session.userId, storeId, permissionCode as any);
  if (!ok) throw new AuthorizationError("لا تملك الصلاحية الدقيقة لتنفيذ هذه العملية على هذا المتجر", 403);
  return session;
}

/* ------------------------------------------------------------------ *
 * Ownership validation (the heart of Merchant Isolation Hardening)
 * ------------------------------------------------------------------ */

/**
 * Verify that a product belongs to a store the caller may access.
 * Returns `{ session, storeId, product }`. Throws 404 (not 403) when the
 * product does not exist OR is not owned by the caller — this avoids leaking
 * the existence of other merchants' products (IDOR hardening).
 */
export async function requireProductOwnership(productId: string) {
  const [product] = await db
    .select({ id: products.id, storeId: products.storeId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw new AuthorizationError("المنتج غير موجود", 404);
  const { session, storeId } = await requireStoreAccess(product.storeId);
  return { session, storeId, product };
}

/**
 * Verify a product variant belongs to a store the caller may access.
 * Used by inventory mutations to prevent cross-merchant stock tampering.
 */
export async function requireVariantOwnership(variantId: string) {
  const [row] = await db
    .select({ variantId: productVariants.id, storeId: products.storeId, productId: products.id })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(productVariants.id, variantId))
    .limit(1);
  if (!row) throw new AuthorizationError("المتغير غير موجود", 404);
  const access = await requireStoreAccess(row.storeId);
  return { session: access.session, storeId: access.storeId, variantId: row.variantId, productId: row.productId };
}

/**
 * Verify an order belongs to the caller — as the store (merchant/employee),
 * the order customer, or an admin. This single guard replaces the scattered
 * fetch-then-check patterns and is the basis of `canManageOrder`.
 */
export async function requireOrderAccess(orderId: string): Promise<{ session: SessionPayload; order: typeof orders.$inferSelect; role: "admin" | "merchant" | "customer" }> {
  const session = await requireAuth();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new AuthorizationError("الطلب غير موجود", 404);

  if (hasRole(session, "super_admin")) return { session, order, role: "admin" };

  // Merchant owner / store employee → the store-bound role assignment, not a
  // legacy literal role code, proves access. This supports granular employee
  // groups while preserving tenant isolation.
  if (hasStoreAccess(session, order.storeId)) return { session, order, role: "merchant" };

  // Customer → must be the order owner.
  if (order.customerId === session.userId) return { session, order, role: "customer" };
  throw new AuthorizationError("لا تملك صلاحية الوصول إلى هذا الطلب", 404);
}

/* ------------------------------------------------------------------ *
 * Domain capability checks (boolean, non-throwing) — for conditional UI
 * ------------------------------------------------------------------ */

/** Can the session manage (mutate) the given order? */
export async function canManageOrder(orderId: string): Promise<boolean> {
  try {
    const { role, session, order } = await requireOrderAccess(orderId);
    if (role === "admin") return true;
    if (role === "merchant") return userHasStorePermission(session.userId, order.storeId, Permission.ManageOrders);
    return false; // customers cannot mutate orders
  } catch {
    return false;
  }
}

/** Can the session manage (mutate) the given product? */
export async function canManageProduct(productId: string): Promise<boolean> {
  try {
    const { session, storeId } = await requireProductOwnership(productId);
    if (hasRole(session, "super_admin")) return true;
    return userHasStorePermission(session.userId, storeId, Permission.ManageProducts);
  } catch {
    return false;
  }
}

/** Convenience: does the session own the given store (or is admin)? */
export function isStoreOwner(session: SessionPayload | null, storeId: string): boolean {
  if (!session) return false;
  return hasRole(session, "super_admin") || hasStoreAccess(session, storeId);
}
