import { and, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import {
  db,
  merchantContracts,
  paymentMethods,
  products,
  shippingMethods,
  storeLaunchReadiness,
  stores
} from "@/lib/db";

type DbLike = any;

export type LaunchCheck = { key: string; label: string; ok: boolean; detail: string; critical: boolean };

export async function calculateStoreLaunchChecks(storeId: string, tx: DbLike = db): Promise<LaunchCheck[]> {
  const [[store], [{ activeProducts }], [{ activePayments }], [{ activeShipping }], [contract]] = await Promise.all([
    tx.select().from(stores).where(eq(stores.id, storeId)).limit(1),
    tx.select({ activeProducts: products.id }).from(products).where(and(eq(products.storeId, storeId), eq(products.status, "active"))).limit(1),
    tx.select({ activePayments: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.isActive, true))).limit(1),
    tx.select({ activeShipping: shippingMethods.id }).from(shippingMethods).where(and(eq(shippingMethods.storeId, storeId), eq(shippingMethods.isActive, true))).limit(1),
    tx.select().from(merchantContracts).where(and(eq(merchantContracts.storeId, storeId), eq(merchantContracts.status, "active"))).limit(1)
  ]);
  if (!store) throw new ApiError("المتجر غير موجود", 404);
  return [
    { key: "contract", label: "عقد متجر فعال", ok: Boolean(contract), detail: contract ? `العقد ${contract.contractNumber}` : "لا يوجد عقد فعال", critical: true },
    { key: "identity", label: "بيانات التواصل والوصف", ok: Boolean(store.description && store.contactPhone && store.contactEmail), detail: "الوصف والهاتف والبريد مطلوبة", critical: true },
    { key: "branding", label: "الشعار والغلاف", ok: Boolean(store.logoUrl && store.coverImageUrl), detail: "ارفع شعاراً وغلافاً", critical: false },
    { key: "catalog", label: "منتج منشور واحد على الأقل", ok: Boolean(activeProducts), detail: "أضف منتجاً نشطاً بسعر ومخزون", critical: true },
    { key: "payment", label: "وسيلة دفع تابعة للتاجر", ok: Boolean(activePayments), detail: "فعّل وسيلة دفع للعميل مباشرة إلى التاجر", critical: true },
    { key: "shipping", label: "وسيلة شحن أو استلام", ok: Boolean(activeShipping), detail: "فعّل وسيلة شحن أو استلام من المتجر", critical: true }
  ];
}

function serializeChecks(checks: LaunchCheck[]) {
  return Object.fromEntries(checks.map((check) => [check.key, { label: check.label, ok: check.ok, detail: check.detail, critical: check.critical }]));
}

export async function ensureStoreLaunchReadiness(input: { storeId: string; applicationId?: string | null; tx?: DbLike }) {
  const tx = input.tx || db;
  const [existing] = await tx.select().from(storeLaunchReadiness).where(eq(storeLaunchReadiness.storeId, input.storeId)).limit(1);
  if (existing) return existing;
  const checks = await calculateStoreLaunchChecks(input.storeId, tx);
  const [readiness] = await tx.insert(storeLaunchReadiness).values({ storeId: input.storeId, applicationId: input.applicationId || null, status: "setup_pending", checks: serializeChecks(checks) }).returning();
  return readiness;
}

export async function getStoreLaunchReadiness(storeId: string) {
  const [readiness] = await db.select().from(storeLaunchReadiness).where(eq(storeLaunchReadiness.storeId, storeId)).limit(1);
  const checks = await calculateStoreLaunchChecks(storeId);
  return { readiness: readiness || null, checks, ready: checks.every((check) => !check.critical || check.ok) };
}

export async function submitStoreLaunchReadiness(input: { storeId: string; actorId: string; note?: string | null }) {
  await ensureStoreLaunchReadiness({ storeId: input.storeId });
  const checks = await calculateStoreLaunchChecks(input.storeId);
  const missing = checks.filter((check) => check.critical && !check.ok);
  if (missing.length) throw new ApiError(`لا يمكن إرسال المتجر للإطلاق قبل استكمال: ${missing.map((check) => check.label).join("، ")}`, 409);
  const now = new Date();
  const [readiness] = await db.update(storeLaunchReadiness).set({ status: "submitted", checks: serializeChecks(checks), submittedAt: now, note: input.note?.trim() || null, updatedAt: now }).where(eq(storeLaunchReadiness.storeId, input.storeId)).returning();
  if (!readiness) throw new ApiError("سجل جاهزية الإطلاق غير موجود", 404);
  return { readiness, checks };
}

export async function reviewStoreLaunchReadiness(input: { storeId: string; actorId: string; action: "approve" | "reject"; note?: string | null }) {
  const now = new Date();
  const checks = await calculateStoreLaunchChecks(input.storeId);
  const missing = checks.filter((check) => check.critical && !check.ok);
  if (input.action === "approve" && missing.length) throw new ApiError(`لا يمكن نشر المتجر قبل استكمال: ${missing.map((check) => check.label).join("، ")}`, 409);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(storeLaunchReadiness).where(eq(storeLaunchReadiness.storeId, input.storeId)).limit(1);
    if (!before || before.status !== "submitted") throw new ApiError("المتجر غير مرسل لمراجعة الإطلاق", 409);
    const nextStatus = input.action === "approve" ? "approved" : "setup_pending";
    const [readiness] = await tx.update(storeLaunchReadiness).set({ status: nextStatus, checks: serializeChecks(checks), reviewedBy: input.actorId, reviewedAt: now, note: input.note?.trim() || before.note, updatedAt: now }).where(eq(storeLaunchReadiness.id, before.id)).returning();
    if (input.action === "approve") await tx.update(stores).set({ status: "active", isActive: true, profileCompleteness: Math.max(0, Math.round((checks.filter((check) => check.ok).length / checks.length) * 100)), updatedAt: now }).where(eq(stores.id, input.storeId));
    return { before, readiness, checks };
  });
}
