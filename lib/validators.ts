import { z } from "zod";

function isUrlOrPath(value: string) {
  if (value === "") return true;
  if (value.startsWith("data:image/")) return true;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export const urlOrPathSchema = z.string().refine(isUrlOrPath, "يجب إدخال رابط صحيح أو مسار يبدأ بـ /");
export const requiredUrlOrPathSchema = z.string().min(1).refine(isUrlOrPath, "يجب إدخال رابط صحيح أو مسار يبدأ بـ /");
export const optionalUrlOrPathSchema = urlOrPathSchema.optional();

const weakPasswordFragments = ["password", "qwerty", "123456", "admin", "demo", "test", "كلمةالمرور"];
export const strongPasswordSchema = z
  .string()
  .min(12, "كلمة المرور يجب أن تكون 12 حرفاً على الأقل")
  .max(128, "كلمة المرور طويلة جداً")
  .refine((value) => !weakPasswordFragments.some((fragment) => value.toLowerCase().replace(/\s+/g, "").includes(fragment)), "كلمة المرور شائعة أو ضعيفة")
  .refine((value) => {
    if (value.length >= 16) return true; // passphrases may favor length over symbols.
    const groups = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9\s]/.test(value)].filter(Boolean).length;
    return groups >= 3;
  }, "استخدم 3 أنواع على الأقل من الأحرف، أو عبارة مرور بطول 16 حرفاً على الأقل");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب"),
  email: z.string().trim().toLowerCase().email("البريد غير صحيح"),
  phone: z.string().trim().optional(),
  password: strongPasswordSchema
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(2),
  password: z.string().min(1)
});

export const merchantApplicationSchema = z.object({
  applicantName: z.string().trim().min(2),
  applicantEmail: z.string().trim().toLowerCase().email(),
  applicantPhone: z.string().trim().optional(),
  applicationType: z.enum(["initial_store", "independent_store"]).default("initial_store"),
  storeName: z.string().trim().min(2),
  businessActivity: z.string().trim().min(2),
  /** The wing is the single, authoritative sector selection. */
  wingId: z.string().uuid(),
  description: z.string().optional(),
  countryId: z.string().uuid().optional().nullable(),
  governorateId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid().optional().nullable(),
  districtId: z.string().uuid().optional().nullable(),
  socialLinks: z.record(z.string()).optional().default({})
});

/** Legacy admin PATCH may update note only; workflow status transitions use the dedicated review service. */
export const merchantApplicationStatusSchema = z.object({
  adminNote: z.string().trim().max(2_000).optional()
});

export const merchantApplicationRevisionSchema = z.object({
  applicantName: z.string().trim().min(2),
  applicantPhone: z.string().trim().min(5).max(40),
  storeName: z.string().trim().min(2),
  businessActivity: z.string().trim().min(2),
  description: z.string().trim().min(10).max(2_000),
  /** The wing is the single, authoritative sector selection. */
  wingId: z.string().uuid(),
  countryId: z.string().uuid().optional().nullable(),
  governorateId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid().optional().nullable(),
  districtId: z.string().uuid().optional().nullable(),
  socialLinks: z.record(z.string()).default({})
});

export const contractSignatureSchema = z.object({
  accepted: z.literal(true),
  signerName: z.string().trim().min(2),
  signatureDataUrl: z.string().startsWith("data:image/"),
  /** Must exactly match the version issued by admin; server rejects mismatch. */
  contractVersion: z.string().trim().min(1).max(40)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPasswordSchema
});

export const wingSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  iconUrl: optionalUrlOrPathSchema,
  heroImageUrl: optionalUrlOrPathSchema,
  mobileImageUrl: optionalUrlOrPathSchema,
  desktopImageUrl: optionalUrlOrPathSchema,
  description: z.string().optional(),
  /** The one merchant catalogue template represented by this wing. */
  activityTemplateKey: z.string().trim().min(2).max(160).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

export const productVariantInputSchema = z.object({
  sku: z.string().optional().default(""),
  barcode: z.string().optional(),
  title: z.string().optional(),
  unitId: z.string().uuid().optional().nullable(),
  sizeId: z.string().uuid().optional().nullable(),
  colorId: z.string().uuid().optional().nullable(),
  price: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().min(0).optional(),
  priceAdjustment: z.coerce.number().default(0),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  imageUrl: optionalUrlOrPathSchema,
  images: z.array(requiredUrlOrPathSchema).optional().default([]),
  attributes: z.record(z.string()).optional().default({}),
  attributeValueIds: z.array(z.string().uuid()).optional().default([])
});

export const productSchema = z.object({
  storeId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(2),
  englishName: z.string().optional(),
  slug: z.string().optional(),
  productCode: z.string().optional(),
  codeMode: z.enum(["auto", "manual"]).default("auto"),
  barcode: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  originCountry: z.string().optional(),
  warranty: z.string().optional(),
  youtubeUrl: optionalUrlOrPathSchema,
  type: z.enum(["simple", "variable"]).default("simple"),
  status: z.enum(["draft", "review", "active", "paused", "inactive", "archived"]).default("draft"),
  publishAt: z.string().datetime().optional().nullable(),
  unpublishAt: z.string().datetime().optional().nullable(),
  basePrice: z.coerce.number().min(0).optional(),
  mainImageUrl: optionalUrlOrPathSchema,
  images: z.array(requiredUrlOrPathSchema).optional().default([]),
  specifications: z.record(z.string()).optional().default({}),
  pricingMode: z.enum(["base_adjustment", "independent"]).default("independent"),
  inventoryMode: z.enum(["product", "variant"]).default("variant"),
  productCommerceType: z.enum(["ONLINE_SALES", "SHOWCASE_ONLY"]).default("ONLINE_SALES"),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  productImages: z.array(z.object({ url: requiredUrlOrPathSchema, alt: z.string().optional(), isPrimary: z.boolean().optional(), attributeValueId: z.string().uuid().optional().nullable(), variantSku: z.string().optional() })).optional().default([]),
  variants: z.array(productVariantInputSchema).min(1).optional()
}).superRefine((value, ctx) => {
  if (value.status !== "active") return;
  const hasBasePrice = Number(value.basePrice || 0) > 0;
  const hasVariantPrice = (value.variants || []).some((variant) => Number(variant.price || 0) > 0);
  if (!hasBasePrice && !hasVariantPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["basePrice"], message: "لا يمكن نشر منتج نشط بدون سعر أكبر من صفر" });
  }
  if (value.codeMode === "manual" && !value.productCode?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productCode"], message: "لا يمكن نشر منتج بكود يدوي بدون رقم/كود المنتج" });
  }
});

export const storeMediaSchema = z.object({
  storeId: z.string().uuid(),
  coverImageUrl: optionalUrlOrPathSchema,
  logoUrl: optionalUrlOrPathSchema,
  introImageUrl: optionalUrlOrPathSchema,
  videoUrl: optionalUrlOrPathSchema,
  gallery: z.array(requiredUrlOrPathSchema).max(20).optional().default([])
});

export const announcementSchema = z.object({
  storeId: z.string().uuid().optional().nullable(),
  title: z.string().min(2),
  summary: z.string().optional(),
  body: z.string().optional(),
  imageUrl: optionalUrlOrPathSchema,
  linkUrl: optionalUrlOrPathSchema,
  isPinned: z.boolean().optional().default(false),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("draft"),
  isPromoted: z.boolean().optional().default(false),
  promotionStart: z.string().datetime().optional().nullable(),
  promotionEnd: z.string().datetime().optional().nullable(),
  promotionPackage: z.string().optional(),
  visibilitySchedule: z.record(z.unknown()).optional().default({})
});

const adOrderAttributionSchema = z.object({
  campaignId: z.string().uuid(),
  placement: z.enum(["homepage_marketplace_ads", "homepage_promo", "search_results", "category_listing", "storefront"]),
  productId: z.string().uuid().optional().nullable(),
  attributionToken: z.string().uuid(),
  clickedAt: z.string().datetime()
});

export const orderCreateSchema = z.object({
  storeId: z.string().uuid(),
  currency: z.string().optional(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  shippingMethodId: z.string().uuid().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid(),
      quantity: z.coerce.number().int().positive()
    })
  ),
  deliveryAddress: z.record(z.unknown()).default({}),
  customerNote: z.string().optional(),
  adAttribution: adOrderAttributionSchema.optional().nullable()
});

export const productTaxonomySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("category"), storeId: z.string().uuid().optional(), parentId: z.string().uuid().optional().nullable(), name: z.string().min(2), code: z.string().optional(), codeMode: z.enum(["auto", "manual"]).default("auto"), imageUrl: optionalUrlOrPathSchema, sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("attribute"), storeId: z.string().uuid().optional(), name: z.string().min(1), code: z.string().min(1), displayType: z.enum(["button", "color", "dropdown", "radio", "text"]).default("button"), isVariantOption: z.boolean().default(true), isRequired: z.boolean().default(false), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("attributeValue"), attributeId: z.string().uuid(), value: z.string().min(1), code: z.string().optional(), colorHex: z.string().optional(), imageUrl: optionalUrlOrPathSchema, sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) })
]);

export const merchantApplicationDocumentSchema = z.object({
  applicationId: z.string().uuid().optional(),
  documentType: z.enum(["commercial_register", "tax_card", "identity", "bank_account", "logo", "store_image", "other"]),
  title: z.string().optional(),
  fileUrl: requiredUrlOrPathSchema,
  fileName: z.string().optional(),
  note: z.string().optional()
});

export const merchantApplicationReviewSchema = z.object({
  action: z.enum(["start_review", "request_documents", "request_changes", "pre_approve", "create_contract", "reject"]),
  adminNote: z.string().optional(),
  contractDurationDays: z.coerce.number().int().positive().optional().default(365),
  revenueModel: z.enum(["monthly_rent", "sales_commission", "hybrid"]).optional().default("monthly_rent"),
  monthlyRent: z.coerce.number().min(0).optional().default(0),
  commissionRate: z.coerce.number().min(0).max(100).optional().default(0),
  dueDays: z.coerce.number().int().min(1).max(90).optional().default(7),
  graceDays: z.coerce.number().int().min(0).max(90).optional().default(7),
  subscriptionFee: z.coerce.number().min(0).optional().default(0),
  contractBody: z.string().optional()
});

export const offerCampaignSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  occasionType: z.string().default("seasonal"),
  description: z.string().optional(),
  imageUrl: optionalUrlOrPathSchema,
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("active"),
  isHomepageVisible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  config: z.record(z.unknown()).default({})
});

export const storeOfferCollectionSchema = z.object({
  storeId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional().nullable(),
  /** Storefront is immediate; homepage is a request that requires admin review. */
  publicationTarget: z.enum(["storefront", "homepage"]),
  title: z.string().min(2),
  description: z.string().optional(),
  imageUrl: optionalUrlOrPathSchema,
  startsAt: z.string().datetime({ message: "بداية العرض مطلوبة" }),
  endsAt: z.string().datetime({ message: "نهاية العرض مطلوبة" }),
  items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid(), quantity: z.coerce.number().int().positive().max(999).default(1), offerPrice: z.coerce.number().min(0).optional() })).min(1).max(500),
  bundlePrice: z.coerce.number().positive().optional(),
  /** Every new offer is assembled into this many real inventory product units. */
  bundleQuantity: z.coerce.number().int().positive().max(100000),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  offerType: z.enum(["single", "bundle", "discount", "exclusive", "clearance", "seasonal"]).optional().default("single"),
  promotionPackage: z.string().optional(),
  visibilitySchedule: z.record(z.unknown()).optional().default({})
}).superRefine((value, ctx) => {
  if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "نهاية العرض يجب أن تكون بعد البداية" });
  }
  const totalQuantity = value.items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  if (value.offerType === "bundle" && value.items.length < 2 && totalQuantity < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "العرض المجمع يجب أن يحتوي على أكثر من صنف أو أكثر من قطعة" });
  }
  if (!value.bundlePrice && !value.discountPercent && !value.items.some((item) => Number(item.offerPrice || 0) > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bundlePrice"], message: "حدد سعر العرض أو نسبة الخصم أو أسعار عروض للمنتجات" });
  }
});

export const adminPromotionalOfferSchema = z.object({
  title: z.string().min(2),
  slug: z.string().optional(),
  category: z.enum(["today", "exclusive", "trending", "new", "seasonal", "external", "admin"]).optional().default("admin"),
  description: z.string().optional(),
  imageUrl: optionalUrlOrPathSchema,
  videoUrl: optionalUrlOrPathSchema,
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  whatsappUrl: optionalUrlOrPathSchema,
  locationText: z.string().optional(),
  externalUrl: optionalUrlOrPathSchema,
  socialLinks: z.record(z.string()).optional().default({}),
  status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("draft"),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isFeatured: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
  visibilitySchedule: z.record(z.unknown()).optional().default({})
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(2)
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: strongPasswordSchema
});
