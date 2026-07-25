export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, colors, db, merchantActivityTemplateCatalog, productAttributes, productAttributeValues, products, sizes, systemSettings, units } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { activityTemplates, makeActivityTemplateCode, normalizeTemplateText, recommendedActivityTemplateKeys } from "@/lib/merchant/activity-templates";
import { catalogRowToActivityTemplate } from "@/lib/merchant/activity-template-catalog";
import { listAvailableActivityTemplates, type ResolvedActivityTemplate } from "@/lib/merchant/activity-template-selection";
import { starterProductCommerceTypeAt, starterProductCommerceTypes, templatesForStoreActivity } from "@/lib/merchant/activity-template-policy";
import { createProductFromDraft } from "@/lib/enterprise/product-intake";
import { generateCategoryCode } from "@/lib/product-coding";
import { slugify } from "@/lib/slug";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { isStoreOperational } from "@/lib/store-guards";
import { writeAuditLog } from "@/lib/audit";

const applySchema = z.object({
  templateKey: z.string().min(2).max(160),
  includeStarterProducts: z.boolean().default(false),
  /** One explicit commerce intent per optional starter draft, in template order. */
  starterProductModes: z.array(z.enum(starterProductCommerceTypes)).max(50).default([])
});
type ResolvedTemplate = ResolvedActivityTemplate;

function colorHexForName(value: string) { const normalized = value.toLowerCase().replace(/[أإآ]/g, "ا"); if (normalized.includes("اسود")) return "#111827"; if (normalized.includes("ابيض")) return "#ffffff"; if (normalized.includes("احمر")) return "#ef4444"; if (normalized.includes("برتقالي")) return "#f97316"; if (normalized.includes("ازرق")) return "#3b82f6"; if (normalized.includes("بيج")) return "#d6c2a3"; if (normalized.includes("بني")) return "#92400e"; if (normalized.includes("وردي")) return "#ec4899"; if (normalized.includes("اصفر")) return "#facc15"; if (normalized.includes("اخضر")) return "#16a34a"; if (normalized.includes("نيلي")) return "#4f46e5"; if (normalized.includes("طبيعي")) return "#c08457"; if (normalized.includes("فضي")) return "#cbd5e1"; return "#94a3b8"; }

async function assertTemplateAccess(session: Awaited<ReturnType<typeof requireAuth>>) { const store = await getMerchantPrimaryStore(session.userId); if (!store) throw new Error("لا يوجد متجر مرتبط بحسابك"); if (!hasStoreAccess(session, store.id)) throw new Error("لا تملك صلاحية إدارة هذا المتجر"); if (!(await userHasAnyStorePermission(session.userId, store.id, [Permission.ManageProductTaxonomy, Permission.ManageStoreSettings]))) throw new Error("لا تملك صلاحية إعدادات الأصناف والمتغيرات"); if (!(await isStoreOperational(store.id))) throw new Error("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن"); return store; }
async function upsertCategory(tx: any, storeId: string, name: string, index: number) { const [existing] = await tx.select().from(categories).where(and(eq(categories.storeId, storeId), eq(categories.name, name))).limit(1); if (existing) return { item: existing, created: false }; const code = await generateCategoryCode(tx, storeId, null); const [item] = await tx.insert(categories).values({ storeId, name, slug: slugify(`${code}-${name}`), code, codeMode: "auto", isActive: true, sortOrder: index }).returning(); return { item, created: true }; }
async function upsertAttributeValue(tx: any, attributeId: string, value: string, displayType: string, index: number) { const [existing] = await tx.select().from(productAttributeValues).where(and(eq(productAttributeValues.attributeId, attributeId), eq(productAttributeValues.value, value))).limit(1); const colorHex = displayType === "color" ? colorHexForName(value) : null; const code = makeActivityTemplateCode("value", value).slice(0, 110); if (existing) { const [item] = await tx.update(productAttributeValues).set({ colorHex: colorHex || existing.colorHex, code: existing.code || code, isActive: true, sortOrder: index, updatedAt: new Date() }).where(eq(productAttributeValues.id, existing.id)).returning(); return { item, created: false }; } const [item] = await tx.insert(productAttributeValues).values({ attributeId, value, code, colorHex, isActive: true, sortOrder: index }).returning(); return { item, created: true }; }

async function allTemplates(): Promise<ResolvedTemplate[]> { return listAvailableActivityTemplates(); }
function recommendedKeys(source: string, templates: ResolvedTemplate[]) { const staticKeys = new Set(recommendedActivityTemplateKeys(source)); const normalized = normalizeTemplateText(source); return templates.filter((template) => staticKeys.has(template.key) || (template.source === "admin" && normalizeTemplateText(`${template.title} ${template.description || ""} ${template.categories.join(" ")}`).split(" ").some((term) => term.length > 2 && normalized.includes(term)))).map((template) => template.key).slice(0, 4); }

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    const source = [store?.name || "", store?.description || ""].join(" ");
    const templates = templatesForStoreActivity(await allTemplates(), store?.activityTemplateKey);
    const recommended = new Set(store?.activityTemplateKey ? [store.activityTemplateKey] : recommendedKeys(source, templates));
    return ok({
      selectedActivityTemplateKey: store?.activityTemplateKey || null,
      selectionLocked: Boolean(store?.activityTemplateKey),
      templates: templates.map((template) => ({
        key: template.key,
        title: template.title,
        description: template.description || "يجهز التصنيفات والوحدات والخصائص المناسبة للنشاط.",
        notice: template.notice || null,
        categories: template.categories,
        units: template.units,
        attributes: template.attributes,
        sizes: template.sizes || [],
        colors: template.colors || [],
        starterProducts: template.starterProducts || [],
        unitsCount: template.units.length,
        attributesCount: template.attributes.length,
        sizesCount: template.sizes?.length || 0,
        colorsCount: template.colors?.length || 0,
        recommended: recommended.has(template.key),
        source: template.source,
        version: template.version
      })),
      recommendedKeys: [...recommended]
    });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل قوالب النشاط");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const store = await assertTemplateAccess(session); const payload = applySchema.parse(await request.json());
    if (store.activityTemplateKey && payload.templateKey !== store.activityTemplateKey) return fail("يمكنك تطبيق القطاع الذي حددته في طلب فتح هذا المتجر فقط.", 403);
    let template: ResolvedTemplate | undefined;
    if (payload.templateKey.startsWith("catalog:")) { const code = payload.templateKey.slice("catalog:".length); const [row] = await db.select().from(merchantActivityTemplateCatalog).where(and(eq(merchantActivityTemplateCatalog.code, code), eq(merchantActivityTemplateCatalog.status, "active"))).limit(1); if (row) template = catalogRowToActivityTemplate(row); }
    else { const base = activityTemplates.find((item) => item.key === payload.templateKey); if (base) template = { ...base, source: "system", version: 1 }; }
    if (!template) return fail("قالب النشاط غير موجود أو معطل", 404);

    const summary = await db.transaction(async (tx) => {
      const counts = { categories: 0, units: 0, sizes: 0, colors: 0, attributes: 0, values: 0, updated: 0 };
      for (let index = 0; index < template!.categories.length; index++) { const result = await upsertCategory(tx, store.id, template!.categories[index], index); result.created ? counts.categories++ : counts.updated++; }
      for (let index = 0; index < template!.units.length; index++) { const unit = template!.units[index]; await tx.insert(units).values({ storeId: store.id, ...unit, sortOrder: index, isActive: true }).onConflictDoUpdate({ target: [units.storeId, units.name], set: { symbol: unit.symbol, sortOrder: index, isActive: true } }); counts.units++; }
      for (let index = 0; index < (template!.sizes || []).length; index++) { const name = template!.sizes![index]; await tx.insert(sizes).values({ storeId: store.id, name, sortOrder: index, isActive: true }).onConflictDoUpdate({ target: [sizes.storeId, sizes.name], set: { sortOrder: index, isActive: true } }); counts.sizes++; }
      for (let index = 0; index < (template!.colors || []).length; index++) { const color = template!.colors![index]; await tx.insert(colors).values({ storeId: store.id, name: color.name, hexCode: color.hexCode, sortOrder: index, isActive: true }).onConflictDoUpdate({ target: [colors.storeId, colors.name], set: { hexCode: color.hexCode, sortOrder: index, isActive: true } }); counts.colors++; }
      for (let index = 0; index < template!.attributes.length; index++) { const attribute = template!.attributes[index]; const code = makeActivityTemplateCode(template!.key, attribute.name); const [attr] = await tx.insert(productAttributes).values({ storeId: store.id, name: attribute.name, code, displayType: attribute.displayType, isVariantOption: true, isRequired: false, sortOrder: index, isActive: true }).onConflictDoUpdate({ target: [productAttributes.storeId, productAttributes.code], set: { name: attribute.name, displayType: attribute.displayType, isVariantOption: true, isRequired: false, sortOrder: index, isActive: true, updatedAt: new Date() } }).returning(); counts.attributes++; for (let valueIndex = 0; valueIndex < attribute.values.length; valueIndex++) { const result = await upsertAttributeValue(tx, attr.id, attribute.values[valueIndex], attribute.displayType, valueIndex); result.created ? counts.values++ : counts.updated++; } }
      return counts;
    });

    const starter = { created: 0, skipped: 0, failed: 0 };
    const starterProducts = template.starterProducts || [];
    const markerKey = `activity_template_starters:${template.key}:v${template.version}`;
    if (payload.includeStarterProducts && starterProducts.length) {
      const [marker] = await db.select({ id: systemSettings.id }).from(systemSettings).where(and(eq(systemSettings.group, `store:${store.id}`), eq(systemSettings.key, markerKey))).limit(1);
      if (marker) starter.skipped = starterProducts.length;
      else {
        for (const [starterIndex, blueprint] of starterProducts.entries()) {
          try {
            const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, store.id), eq(categories.name, blueprint.category))).limit(1);
            const [existing] = category ? await db.select({ id: products.id }).from(products).where(and(eq(products.storeId, store.id), eq(products.categoryId, category.id), eq(products.name, blueprint.name))).limit(1) : [];
            if (!category || existing) { starter.skipped++; continue; }
            await createProductFromDraft(store, { name: blueprint.name, categoryId: category.id, shortDescription: blueprint.description || "", description: blueprint.description || "", attributes: blueprint.attributes || {}, basePrice: 0, stockQuantity: 0, status: "draft", productCommerceType: starterProductCommerceTypeAt(payload.starterProductModes, starterIndex) }, session.userId, "create");
            starter.created++;
          } catch { starter.failed++; }
        }
        await db.insert(systemSettings).values({ group: `store:${store.id}`, key: markerKey, value: { templateKey: template.key, version: template.version, created: starter.created, skipped: starter.skipped, failed: starter.failed, starterProductModes: payload.starterProductModes.map((mode, index) => ({ index, productCommerceType: mode })) }, isPublic: false, updatedBy: session.userId }).onConflictDoNothing({ target: [systemSettings.group, systemSettings.key] });
      }
    }
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "activity_template_apply", entityId: store.id, afterData: { templateKey: template.key, templateTitle: template.title, source: template.source, version: template.version, summary, starter } });
    return ok({ template: { key: template.key, title: template.title, source: template.source, version: template.version }, summary, starter, message: `تم تطبيق قالب ${template.title} وحفظه ضمن إعدادات المتجر` });
  } catch (error) { return handleApiError(error, "تعذر تطبيق قالب النشاط"); }
}
