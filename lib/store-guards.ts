import { eq } from "drizzle-orm";
import { db, stores } from "@/lib/db";

export async function isStoreOperational(storeId: string) {
  const [store] = await db.select({ status: stores.status, isActive: stores.isActive }).from(stores).where(eq(stores.id, storeId)).limit(1);
  return Boolean(store && store.status !== "frozen" && store.status !== "closed" && store.status !== "suspended" && store.isActive);
}
