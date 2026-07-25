export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, wishlists } from "@/lib/db";

export async function DELETE(_request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await context.params;
    const session = await requireAuth();
    await db.delete(wishlists).where(and(eq(wishlists.userId, session.userId), eq(wishlists.productId, productId)));
    return ok({ message: "تم حذف المنتج من المفضلة" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف المنتج من المفضلة");
  }
}
