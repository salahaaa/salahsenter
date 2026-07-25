export type DefaultHomeSection = {
  code: string;
  title: string;
  type: string;
  sortOrder: number;
  isVisible: boolean;
  config: Record<string, unknown>;
};

export const defaultHomeSections: DefaultHomeSection[] = [
  { code: "top_news", title: "شريط أخبار المول", type: "top_news", sortOrder: 1, isVisible: true, config: {} },
  { code: "header", title: "الهيدر والقائمة", type: "header", sortOrder: 2, isVisible: true, config: {} },
  { code: "hero", title: "Hero Section", type: "hero", sortOrder: 3, isVisible: true, config: {} },
  { code: "promo_banners", title: "بانرات العروض", type: "promo", sortOrder: 4, isVisible: true, config: {} },
  { code: "seasonal_offers", title: "العروض", type: "seasonal_offers", sortOrder: 5, isVisible: true, config: {} },
  { code: "featured_stores", title: "المتاجر المميزة", type: "featured_stores", sortOrder: 6, isVisible: true, config: {} },
  { code: "featured_wings", title: "استكشف أجنحة المول", type: "wings", sortOrder: 7, isVisible: true, config: {} },
  { code: "marketplace_ads", title: "إعلانات المول العامة", type: "marketplace_ads", sortOrder: 8, isVisible: true, config: {} },
  { code: "promoted_offers", title: "عروض مميزة", type: "promoted_offers", sortOrder: 9, isVisible: true, config: {} },
  { code: "trending_products", title: "المنتجات الرائجة", type: "products", sortOrder: 10, isVisible: true, config: {} },
  { code: "trending_stores", title: "المتاجر الرائجة", type: "stores", sortOrder: 11, isVisible: true, config: {} },
  { code: "latest_additions", title: "أحدث الإضافات", type: "latest_additions", sortOrder: 12, isVisible: true, config: {} },
  { code: "merchant_cta", title: "دعوة فتح متجر", type: "merchant_cta", sortOrder: 13, isVisible: true, config: {} },
  { code: "footer", title: "الفوتر", type: "footer", sortOrder: 14, isVisible: true, config: {} }
];

export function normalizeHomeSectionCode(code: string) {
  const map: Record<string, string> = {
    marketplace_news: "top_news",
    hero_banners: "hero",
    latest_stores: "featured_stores",
    wings: "featured_wings"
  };
  return map[code] || code;
}
