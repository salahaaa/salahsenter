import { asc, eq } from "drizzle-orm";
import { db, menuItems } from "@/lib/db";

export type PublicMenuItem = { id: string; title: string; url: string; target: string };

function safeMenuUrl(value: string) {
  const url = value.trim();
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

export async function getPublicMenuItems(menuKey = "main") {
  try {
    const rows = await db.select({ id: menuItems.id, title: menuItems.title, url: menuItems.url, target: menuItems.target }).from(menuItems).where(eq(menuItems.menuKey, menuKey)).orderBy(asc(menuItems.sortOrder)).limit(20);
    return rows.map((row) => ({ ...row, url: safeMenuUrl(row.url) })).filter((row): row is PublicMenuItem => Boolean(row.url));
  } catch {
    return [] as PublicMenuItem[];
  }
}
