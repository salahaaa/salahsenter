import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";

const group = "homepage";
const key = "layout_mode";

export async function isHomeLayoutManaged() {
  try {
    const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(and(eq(systemSettings.group, group), eq(systemSettings.key, key))).limit(1);
    return Boolean((setting?.value as Record<string, unknown> | undefined)?.managed);
  } catch { return false; }
}

export async function setHomeLayoutManaged(tx: typeof db | any, actorId: string) {
  await tx.insert(systemSettings).values({ group, key, value: { managed: true }, isPublic: false, updatedBy: actorId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: { managed: true }, updatedBy: actorId, updatedAt: new Date() } });
}
