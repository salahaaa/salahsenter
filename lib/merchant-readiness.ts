import { and, eq, sql } from "drizzle-orm";
import { categories, db, productAttributes, productAttributeValues, systemSettings, units, users, type Store } from "@/lib/db";

export type StoreSetupStep = {
  key: "password" | "currency" | "categories" | "units" | "attributes" | "attributeValues";
  title: string;
  description: string;
  href: string;
  done: boolean;
  required: boolean;
};

export type StoreSetupStatus = {
  ready: boolean;
  steps: StoreSetupStep[];
  counts: {
    categories: number;
    units: number;
    attributes: number;
    attributeValues: number;
  };
};

export async function getStoreSetupStatus(userId: string, store: Pick<Store, "id">): Promise<StoreSetupStatus> {
  const [userRow, currencySetting, categoriesCount, unitsCount, attributesCount, attributeValuesCount] = await Promise.all([
    db.select({ mustChangePassword: users.mustChangePassword }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ id: systemSettings.id }).from(systemSettings).where(and(eq(systemSettings.group, `store:${store.id}`), eq(systemSettings.key, "currency_settings"))).limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(categories).where(and(eq(categories.storeId, store.id), eq(categories.isActive, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(units).where(and(eq(units.storeId, store.id), eq(units.isActive, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(productAttributes).where(and(eq(productAttributes.storeId, store.id), eq(productAttributes.isActive, true), eq(productAttributes.isVariantOption, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productAttributeValues)
      .innerJoin(productAttributes, eq(productAttributeValues.attributeId, productAttributes.id))
      .where(and(eq(productAttributes.storeId, store.id), eq(productAttributes.isActive, true), eq(productAttributeValues.isActive, true)))
  ]);

  const counts = {
    categories: Number(categoriesCount[0]?.count || 0),
    units: Number(unitsCount[0]?.count || 0),
    attributes: Number(attributesCount[0]?.count || 0),
    attributeValues: Number(attributeValuesCount[0]?.count || 0)
  };

  const steps: StoreSetupStep[] = [
    {
      key: "password",
      title: "تغيير كلمة المرور المؤقتة",
      description: "يجب تغيير كلمة المرور المؤقتة قبل تنفيذ عمليات تشغيلية داخل المتجر.",
      href: "/merchant/settings#password",
      done: !userRow[0]?.mustChangePassword,
      required: true
    },
    {
      key: "currency",
      title: "تهيئة العملة الافتراضية والعملات",
      description: "حدد عملة المتجر الأساسية وأسعار التحويل قبل إدخال الأسعار.",
      href: "/merchant/currencies",
      done: Boolean(currencySetting[0]?.id),
      required: true
    },
    {
      key: "categories",
      title: "إضافة المجموعات والأقسام",
      description: "يجب وجود قسم واحد على الأقل حتى لا يتم حفظ منتج بلا تصنيف.",
      href: "/merchant/product-taxonomy?tab=categories",
      done: counts.categories > 0,
      required: true
    },
    {
      key: "units",
      title: "تهيئة الوحدات",
      description: "أضف وحدات البيع مثل قطعة، كرتون، كيلو، لتر حسب نشاط المتجر.",
      href: "/merchant/product-taxonomy?tab=units",
      done: counts.units > 0,
      required: true
    },
    {
      key: "attributes",
      title: "تهيئة خصائص المتغيرات",
      description: "أضف خصائص مثل اللون، المقاس، السعة، الخامة، أو أي خاصية مناسبة لنشاطك.",
      href: "/merchant/product-taxonomy?tab=attributes",
      done: counts.attributes > 0,
      required: true
    },
    {
      key: "attributeValues",
      title: "إضافة قيم المتغيرات",
      description: "أضف قيماً للخصائص حتى تظهر في قوائم اختيار المنتج وتوليد التركيبات.",
      href: "/merchant/product-taxonomy?tab=values",
      done: counts.attributeValues > 0,
      required: true
    }
  ];

  return { ready: steps.every((step) => !step.required || step.done), steps, counts };
}

export function formatSetupMissingMessage(status: StoreSetupStatus) {
  const missing = status.steps.filter((step) => step.required && !step.done).map((step) => step.title);
  return missing.length ? `يجب استكمال تهيئة المتجر قبل إضافة المنتجات: ${missing.join("، ")}` : "تهيئة المتجر مكتملة";
}
