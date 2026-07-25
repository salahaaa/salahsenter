export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, shoppingCartItems, shoppingCarts } from "@/lib/db";

const patchSchema = z.object({ quantity: z.coerce.number().int().positive().max(999) });

async function assertOwnsItem(userId: string, id: string) {
  const [row] = await db
    .select({ item: shoppingCartItems, cart: shoppingCarts })
    .from(shoppingCartItems)
    .innerJoin(shoppingCarts, eq(shoppingCartItems.cartId, shoppingCarts.id))
    .where(and(eq(shoppingCartItems.id, id), eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, "active")))
    .limit(1);
  return row;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = patchSchema.parse(await request.json());
    const row = await assertOwnsItem(session.userId, id);
    if (!row) return fail("عنصر السلة غير موجود", 404);
    const [item] = await db.update(shoppingCartItems).set({ quantity: payload.quantity, updatedAt: new Date() }).where(eq(shoppingCartItems.id, id)).returning();
    await db.update(shoppingCarts).set({ updatedAt: new Date() }).where(eq(shoppingCarts.id, row.cart.id));
    return ok({ item, message: "تم تحديث الكمية" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث السلة");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const row = await assertOwnsItem(session.userId, id);
    if (!row) return fail("عنصر السلة غير موجود", 404);
    await db.delete(shoppingCartItems).where(eq(shoppingCartItems.id, id));
    await db.update(shoppingCarts).set({ updatedAt: new Date() }).where(eq(shoppingCarts.id, row.cart.id));
    return ok({ message: "تم حذف العنصر" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف عنصر السلة");
  }
}
