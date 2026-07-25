export type TextAudience = "customer" | "public";

export type PlatformTextDefinition = {
  key: string;
  namespace: string;
  audience: TextAudience;
  description: string;
  defaultValue: string;
};

/**
 * Customer-facing UI copy that has no specialised content manager elsewhere.
 * Homepage, identity, welcome-popup, ads, CMS and offers keep their existing
 * dedicated admin managers as their single source of truth.
 */
export const PLATFORM_TEXT_CATALOG: readonly PlatformTextDefinition[] = [
  { key: "header.trust.shipping", namespace: "header", audience: "public", description: "رسالة الثقة: الشحن", defaultValue: "خيارات شحن حسب المتجر" },
  { key: "header.trust.reviewable_stores", namespace: "header", audience: "public", description: "رسالة الثقة: مراجعة المتاجر", defaultValue: "متاجر قابلة للمراجعة" },
  { key: "header.trust.policy", namespace: "header", audience: "public", description: "رسالة الثقة: السياسة", defaultValue: "سياسة واضحة لكل متجر" },
  { key: "welcome.decorative_offer", namespace: "welcome_popup", audience: "public", description: "النص الزخرفي فوق صورة نافذة الترحيب", defaultValue: "عرض ترحيبي" },
  { key: "auth.login.google", namespace: "auth", audience: "customer", description: "زر الدخول عبر Google", defaultValue: "المتابعة عبر Google" },
  { key: "auth.login.divider", namespace: "auth", audience: "customer", description: "فاصل طرق تسجيل الدخول", defaultValue: "أو استخدم بيانات حسابك" },
  { key: "auth.login.submit", namespace: "auth", audience: "customer", description: "زر تسجيل الدخول", defaultValue: "تسجيل الدخول بأمان" },
  { key: "auth.login.forgot_password", namespace: "auth", audience: "customer", description: "رابط استعادة كلمة المرور", defaultValue: "نسيت كلمة المرور؟" },
  { key: "auth.password.mfa_title", namespace: "auth", audience: "customer", description: "عنوان التحقق الإضافي للدخول", defaultValue: "تحقق إضافي لحماية الحساب" },
  { key: "customer.orders.empty", namespace: "orders", audience: "customer", description: "رسالة عدم وجود طلبات للمتسوق", defaultValue: "لا توجد طلبات" },
  { key: "customer.wishlist.empty", namespace: "wishlist", audience: "customer", description: "رسالة عدم وجود منتجات مفضلة", defaultValue: "لا توجد منتجات في المفضلة" },
  { key: "customer.cart.empty", namespace: "cart", audience: "customer", description: "رسالة السلة الفارغة", defaultValue: "سلة التسوق فارغة" },
  { key: "common.back_to_home", namespace: "common", audience: "customer", description: "زر العودة إلى الرئيسية للمتسوق", defaultValue: "العودة للرئيسية" }
] as const;

/** Keys created by the first prototype that duplicated specialised content managers. Sync retires them safely if they exist in a database. */
export const RETIRED_DUPLICATE_TEXT_KEYS = [
  "home.content.platformName", "home.content.platformSubtitle", "home.content.logoLetter", "home.content.searchPlaceholder", "home.content.loginLabel", "home.content.openStoreLabel", "home.content.newsLabel", "home.content.heroBadge", "home.content.heroTitle", "home.content.heroSubtitle", "home.content.heroWingsLabel", "home.content.heroStoresLabel", "home.content.heroAvailabilityLabel", "home.content.promoPrimaryButton", "home.content.promoSecondaryButton", "home.content.featuredStoresKicker", "home.content.featuredStoresDescription", "home.content.wingsKicker", "home.content.wingsDescription", "home.content.wingsAllButton", "home.content.productsKicker", "home.content.latestTitle", "home.content.latestHighlight", "home.content.merchantCtaBadge", "home.content.merchantCtaTitle", "home.content.merchantCtaDescription", "home.content.merchantCtaButton", "home.content.footerText",
  "platform.identity.platformName", "platform.identity.shortName", "platform.identity.tagline", "platform.identity.description", "platform.identity.header_topBarText", "platform.identity.header_openStoreLabel", "platform.identity.footer_trustTitle", "platform.identity.footer_trustText",
  "welcome.popup.badgeText", "welcome.popup.title", "welcome.popup.message", "welcome.popup.couponCode", "welcome.popup.buttonText"
] as const;

export const PLATFORM_TEXT_BY_KEY = new Map(PLATFORM_TEXT_CATALOG.map((entry) => [entry.key, entry]));
