export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  adCampaigns,
  adminPromotionalOffers,
  announcements,
  banners,
  categories,
  db,
  defaultActivityMedia,
  productImages,
  products,
  productVariants,
  storeMedia,
  storeOfferCollections,
  storeOfferItems,
  stores,
  systemSettings,
  wings
} from "@/lib/db";
import { isInlineDataImageUrl, parseInlineDataImage } from "@/lib/inline-media";

const rowMediaSources = {
  products: { table: products, idColumn: products.id, fields: { mainImageUrl: products.mainImageUrl, images: products.images } },
  productVariants: { table: productVariants, idColumn: productVariants.id, fields: { imageUrl: productVariants.imageUrl, images: productVariants.images } },
  stores: { table: stores, idColumn: stores.id, fields: { coverImageUrl: stores.coverImageUrl, logoUrl: stores.logoUrl, introImageUrl: stores.introImageUrl } },
  wings: { table: wings, idColumn: wings.id, fields: { iconUrl: wings.iconUrl, heroImageUrl: wings.heroImageUrl, mobileImageUrl: wings.mobileImageUrl, desktopImageUrl: wings.desktopImageUrl } },
  banners: { table: banners, idColumn: banners.id, fields: { imageUrl: banners.imageUrl } },
  announcements: { table: announcements, idColumn: announcements.id, fields: { imageUrl: announcements.imageUrl } },
  adminPromotionalOffers: { table: adminPromotionalOffers, idColumn: adminPromotionalOffers.id, fields: { imageUrl: adminPromotionalOffers.imageUrl } },
  storeOfferCollections: { table: storeOfferCollections, idColumn: storeOfferCollections.id, fields: { imageUrl: storeOfferCollections.imageUrl } },
  storeOfferItems: { table: storeOfferItems, idColumn: storeOfferItems.id, fields: { imageUrl: storeOfferItems.imageUrl } },
  categories: { table: categories, idColumn: categories.id, fields: { imageUrl: categories.imageUrl } },
  storeMedia: { table: storeMedia, idColumn: storeMedia.id, fields: { url: storeMedia.url } },
  defaultActivityMedia: { table: defaultActivityMedia, idColumn: defaultActivityMedia.id, fields: { url: defaultActivityMedia.url } },
  productImages: { table: productImages, idColumn: productImages.id, fields: { url: productImages.url } }
} as const;

const settingsMediaFields: Record<string, Set<string>> = {
  "homepage:content": new Set(["heroBackgroundImage"]),
  "homepage:welcome_popup": new Set(["imageUrl"]),
  "offers:page_settings": new Set(["heroBackgroundImage", "listBackgroundImage"])
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || "";
  const field = searchParams.get("field") || "";

  try {
    const value = entity === "settings" ? await getSettingsMediaValue(searchParams, field) : await getRowMediaValue(entity, searchParams.get("id") || "", field, searchParams.get("index"));
    if (!value) return new NextResponse("Media not found", { status: 404 });

    if (!isInlineDataImageUrl(value)) {
      if (/^https?:\/\//.test(value) || value.startsWith("/")) return NextResponse.redirect(value.startsWith("/") ? new URL(value, request.url) : value, { status: 307 });
      return new NextResponse("Unsupported media source", { status: 415 });
    }

    const parsed = parseInlineDataImage(value);
    if (!parsed) return new NextResponse("Invalid media", { status: 415 });

    const buffer = Buffer.from(parsed.base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": parsed.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Failed to read inline media", error);
    return new NextResponse("Media error", { status: 500 });
  }
}

async function getRowMediaValue(entity: string, id: string, field: string, indexRaw?: string | null) {
  if (!id || !field) return null;
  if (entity === "adCampaigns" && field === "creativeImageUrl") {
    const [row] = await db.select({ creative: adCampaigns.creative }).from(adCampaigns).where(eq(adCampaigns.id, id)).limit(1);
    const creative = (row?.creative || {}) as Record<string, unknown>;
    return typeof creative.imageUrl === "string" ? creative.imageUrl : null;
  }
  const source = rowMediaSources[entity as keyof typeof rowMediaSources];
  if (!source) return null;
  const column = source.fields[field as keyof typeof source.fields];
  if (!column) return null;

  const rows = await db
    .select({ value: column as any })
    .from(source.table as any)
    .where(eq(source.idColumn as any, id))
    .limit(1);
  const row = rows[0] as { value?: unknown } | undefined;
  if (typeof row?.value === "string") return row.value;
  if (Array.isArray(row?.value)) {
    const index = Number(indexRaw);
    return Number.isInteger(index) && index >= 0 && typeof row.value[index] === "string" ? row.value[index] : null;
  }

  return null;
}

async function getSettingsMediaValue(searchParams: URLSearchParams, field: string) {
  const group = searchParams.get("group") || "";
  const key = searchParams.get("key") || "";
  const allowed = settingsMediaFields[`${group}:${key}`];
  if (!group || !key || !field || !allowed?.has(field)) return null;

  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(and(eq(systemSettings.group, group), eq(systemSettings.key, key)))
    .limit(1);

  const value = row?.value as Record<string, unknown> | undefined;
  const image = value?.[field];
  return typeof image === "string" ? image : null;
}
