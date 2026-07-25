export type AdBannerSuggestionInput = {
  storeName: string;
  campaignType: string;
  productNames?: string[];
  objective?: string;
  offerText?: string;
  audience?: string;
  tone?: "premium" | "urgent" | "friendly" | "seasonal";
};

export type AdBannerSuggestion = {
  campaignName: string;
  headline: string;
  description: string;
  cta: string;
  keywords: string[];
  linkHint: string;
  colorPalette: { name: string; background: string; accent: string; text: string };
  layout: string;
  visualBrief: string;
  imageGenerationPrompt: string;
  creativeConcepts: Array<{
    id: "product_hero" | "offer_focus" | "trust_story";
    name: string;
    rationale: string;
    headline: string;
    cta: string;
    layout: string;
    visualPrompt: string;
    mobileSafeArea: string;
    colorPalette: { name: string; background: string; accent: string; text: string };
  }>;
  reviewChecklist: string[];
};

const palettes = {
  premium: { name: "فاخر", background: "#0f172a", accent: "#f59e0b", text: "#ffffff" },
  urgent: { name: "عاجل", background: "#7f1d1d", accent: "#fbbf24", text: "#ffffff" },
  friendly: { name: "ودّي", background: "#ecfeff", accent: "#0891b2", text: "#0f172a" },
  seasonal: { name: "موسمي", background: "#14532d", accent: "#fde68a", text: "#ffffff" }
} as const;

function clean(value?: string) {
  return String(value || "").trim();
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function suggestAdBanner(input: AdBannerSuggestionInput): AdBannerSuggestion {
  const products = unique(input.productNames || []).slice(0, 4);
  const mainProduct = products[0] || "منتجات مختارة";
  const objective = clean(input.objective) || "زيادة الزيارات والمبيعات";
  const offer = clean(input.offerText);
  const audience = clean(input.audience) || "عملاء المنصة القريبون من نشاط المتجر";
  const tone = input.tone || (offer ? "urgent" : "premium");
  const palette = palettes[tone];
  const isBanner = ["homepage_banner", "category_banner"].includes(input.campaignType);
  const productText = products.length > 1 ? products.join(" + ") : mainProduct;
  const cta = offer ? "استفد من العرض الآن" : isBanner ? "تسوّق الآن" : "شاهد المنتج";
  const headline = offer ? `${offer} على ${mainProduct}` : `${mainProduct} من ${input.storeName}`;
  const description = products.length
    ? `اكتشف ${productText} بجودة مناسبة وسعر منافس لدى ${input.storeName}. ${objective}.`
    : `حملة احترافية من ${input.storeName} تستهدف ${audience} بهدف ${objective}.`;
  const keywords = unique([
    input.storeName,
    mainProduct,
    ...products,
    offer,
    "عرض",
    "تسوق",
    "خصم",
    "منتجات مميزة",
    ...(audience ? audience.split(/\s+/).slice(0, 5) : [])
  ]).slice(0, 12);

  const creativeConcepts: AdBannerSuggestion["creativeConcepts"] = [
    {
      id: "product_hero",
      name: "بطل المنتج",
      rationale: "يركز على منتج واحد واضح لرفع التذكر والنقر من الجوال.",
      headline,
      cta,
      layout: "صورة المنتج في الثلث الأيمن، النص في الوسط، زر CTA في الثلث الأيسر مع مساحة آمنة حول الحواف.",
      visualPrompt: `بنر إعلاني عربي أفقي 1200×400 لمنتج ${mainProduct} من ${input.storeName}. المنتج كبير وواضح في اليمين، خلفية ${palette.name}، عنوان قصير '${headline}'، زر '${cta}'، إضاءة تجارية ناعمة، بدون نصوص صغيرة أو شعارات طرف ثالث.`,
      mobileSafeArea: "اترك 12% من الحافتين و35% من الوسط للنص حتى لا يقتطع على الجوال.",
      colorPalette: palette
    },
    {
      id: "offer_focus",
      name: "تركيز العرض",
      rationale: "يبرز الخصم أو العرض محدود المدة مع CTA مباشر ويصلح للحملات العاجلة.",
      headline: offer ? `${offer} — ${mainProduct}`.slice(0, 75) : `عرض خاص على ${mainProduct}`.slice(0, 75),
      cta: "اطلب العرض الآن",
      layout: "شارة العرض في الأعلى، المنتج في الخلفية اليمنى، قيمة العرض بخط كبير في المنتصف، والزر في الأسفل.",
      visualPrompt: `بنر ترويجي عربي أفقي 1200×400 لعرض ${offer || "خاص"} من ${input.storeName} على ${mainProduct}. أظهر العرض بوضوح من دون أرقام أو وعود غير مؤكدة، ألوان عالية التباين، زر واضح 'اطلب العرض الآن'، تصميم نظيف مناسب للجوال.`,
      mobileSafeArea: "ضع قيمة العرض والعنوان في المنطقة الوسطى بعرض لا يتجاوز 55% من البنر.",
      colorPalette: palettes.urgent
    },
    {
      id: "trust_story",
      name: "قصة الثقة",
      rationale: "يبني الموثوقية للمتجر أو الفئة ويصلح للمنتجات التي تحتاج شرحًا قبل الشراء.",
      headline: `${mainProduct} بجودة من ${input.storeName}`.slice(0, 75),
      cta: "اكتشف التفاصيل",
      layout: "لقطة استخدام واقعية للمنتج، عنوان هادئ، ثلاث كلمات قيمة كحد أقصى، وزر CTA بسيط.",
      visualPrompt: `بنر علامة تجارية عربي 1200×400 ل${input.storeName} يعرض استخدام ${mainProduct} بصورة واقعية دافئة. أسلوب ${palette.name} نظيف، عنوان '${mainProduct} بجودة من ${input.storeName}'، زر 'اكتشف التفاصيل'، لا تضع نصوصًا كثيرة داخل الصورة.`,
      mobileSafeArea: "حافظ على العنصر البشري/المنتج في أحد الجانبين واترك الوسط فارغًا نسبيًا لقراءة العنوان.",
      colorPalette: palettes.friendly
    }
  ];

  return {
    campaignName: offer ? `${input.storeName} - ${offer}` : `${input.storeName} - حملة ${mainProduct}`,
    headline: headline.slice(0, 75),
    description: description.slice(0, 180),
    cta,
    keywords,
    linkHint: products.length ? "/store/STORE_SLUG أو رابط المنتج المختار" : "/store/STORE_SLUG",
    colorPalette: palette,
    layout: isBanner ? "بنر أفقي 1200×400: المنتج يمين، العنوان الكبير وسط، زر CTA يسار، شعار المتجر في الأعلى." : "بطاقة منتج مربعة: صورة المنتج أعلى، السعر/العرض في المنتصف، زر CTA واضح أسفل.",
    visualBrief: `استخدم خلفية ${palette.name}، لون إبراز ${palette.accent}، صورة واضحة لـ ${mainProduct}، عنوان قصير: ${headline}، وزر: ${cta}. لا تضع أكثر من 8 كلمات كبيرة داخل البنر.`,
    imageGenerationPrompt: creativeConcepts[0].visualPrompt,
    creativeConcepts,
    reviewChecklist: [
      "الصورة واضحة وغير مقصوصة ومرفوعة على Cloudinary/رابط آمن.",
      "النص قصير ومقروء على الجوال.",
      "الرابط يقود إلى المتجر أو المنتج الصحيح.",
      "لا توجد مبالغة سعرية أو وعود غير قابلة للتحقق.",
      "الميزانية اليومية مناسبة لمدة الحملة."
    ]
  };
}
