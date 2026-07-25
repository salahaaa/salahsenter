"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Category = { id: string; name: string; code: string | null; parentId: string | null; level: number; isActive: boolean };
type Attribute = { id: string; name: string; code: string; displayType: string; isActive: boolean; isRequired?: boolean };
type AttributeValue = { id: string; attributeId: string; value: string; code: string | null; colorHex: string | null; imageUrl: string | null; isActive: boolean };
type Unit = { id: string; name: string; symbol: string | null; isActive: boolean };
type Size = { id: string; name: string; isActive: boolean };
type Color = { id: string; name: string; hexCode: string | null; isActive: boolean };

export type ProductTaxonomyTab = "categories" | "units" | "attributes" | "values" | "overview";

const tabs: Array<{ id: ProductTaxonomyTab; label: string; description: string }> = [
  { id: "categories", label: "المجموعات", description: "أقسام المنتجات" },
  { id: "units", label: "الوحدات", description: "حبة، كيس، كرتون" },
  { id: "attributes", label: "المتغيرات", description: "العبوة، اللون، المقاس" },
  { id: "values", label: "قيم المتغيرات", description: "كرتون، أحمر، كبير" },
  { id: "overview", label: "نظرة عامة", description: "ملخص الإعدادات" }
];

const presetUnits = [
  { name: "حبة", symbol: "1 حبة" },
  { name: "كيس", symbol: "حسب التعبئة" },
  { name: "كرتون", symbol: "20 حبة" },
  { name: "درزن", symbol: "12 حبة" }
];

type ActivityTemplate = {
  key: string;
  title: string;
  categories: string[];
  units: Array<{ name: string; symbol?: string }>;
  attributes: Array<{ name: string; displayType: string; values: string[] }>;
  sizes?: string[];
  colors?: Array<{ name: string; hexCode: string }>;
};

const activityTemplates: ActivityTemplate[] = [
  {
    key: "restaurant",
    title: "مطعم / كافيه",
    categories: ["وجبات رئيسية", "مشروبات", "حلويات", "إضافات"],
    units: [{ name: "وجبة", symbol: "1 وجبة" }, { name: "كوب", symbol: "250ml" }, { name: "طبق", symbol: "حسب الحجم" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["صغير", "وسط", "كبير"] },
      { name: "درجة الحرارة", displayType: "button", values: ["بارد", "حار"] },
      { name: "الإضافات", displayType: "button", values: ["بدون", "جبن", "صلصة", "بطاطس"] }
    ]
  },
  {
    key: "fashion",
    title: "ملابس / أزياء",
    categories: ["رجالي", "نسائي", "أطفال", "أحذية", "إكسسوارات"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "طقم", symbol: "مجموعة" }],
    attributes: [
      { name: "المقاس", displayType: "button", values: ["XS", "S", "M", "L", "XL", "XXL"] },
      { name: "اللون", displayType: "color", values: ["أسود", "أبيض", "أحمر", "أزرق", "بيج"] },
      { name: "الخامة", displayType: "button", values: ["قطن", "جلد", "جينز", "بوليستر"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "أسود", hexCode: "#111827" },
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "أزرق", hexCode: "#2563eb" },
      { name: "رمادي", hexCode: "#64748b" },
      { name: "بني", hexCode: "#92400e" },
      { name: "وردي", hexCode: "#ec4899" }
    ]
  },
  {
    key: "shoes",
    title: "أحذية / رياضي ورسمي",
    categories: ["أحذية رجالية", "أحذية نسائية", "أحذية أطفال", "أحذية رياضية", "أحذية رسمية", "إكسسوارات الأحذية"],
    units: [{ name: "زوج", symbol: "2 قطعة" }, { name: "قطعة", symbol: "1 قطعة" }],
    attributes: [
      { name: "المقاس", displayType: "button", values: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"] },
      { name: "اللون", displayType: "color", values: ["أسود", "أبيض", "بني", "رمادي", "أزرق"] },
      { name: "الاستخدام", displayType: "button", values: ["جري", "مشي", "رسمي", "كاجوال", "ملاعب"] }
    ],
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
    colors: [
      { name: "أسود", hexCode: "#111827" },
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "بني", hexCode: "#92400e" },
      { name: "رمادي", hexCode: "#64748b" },
      { name: "أزرق", hexCode: "#2563eb" }
    ]
  },
  {
    key: "home-tools",
    title: "أدوات منزلية / مطبخ ونظافة",
    categories: ["أدوات النظافة", "أدوات المطبخ", "التخزين والتنظيم", "إكسسوارات الحمام", "الإضاءة", "العروض المنزلية"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "طقم", symbol: "مجموعة" }, { name: "كرتون", symbol: "حسب المنتج" }, { name: "عبوة", symbol: "حسب الحجم" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["صغير", "متوسط", "كبير", "عائلي"] },
      { name: "اللون", displayType: "color", values: ["أبيض", "أسود", "رمادي", "بيج", "فضي"] },
      { name: "الخامة", displayType: "button", values: ["ستانلس ستيل", "بلاستيك", "خشب", "قماش", "زجاج"] }
    ],
    sizes: ["صغير", "متوسط", "كبير", "عائلي"],
    colors: [
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "أسود", hexCode: "#111827" },
      { name: "رمادي", hexCode: "#64748b" },
      { name: "بيج", hexCode: "#d6b48c" },
      { name: "فضي", hexCode: "#94a3b8" }
    ]
  },
  {
    key: "furniture",
    title: "أثاث ومفروشات",
    categories: ["غرف معيشة", "غرف نوم", "طاولات", "كراسي", "ديكور", "مفروشات"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "طقم", symbol: "مجموعة" }],
    attributes: [
      { name: "المقاس", displayType: "button", values: ["صغير", "متوسط", "كبير", "عائلي"] },
      { name: "اللون", displayType: "color", values: ["رمادي", "بيج", "بني", "أسود", "طبيعي"] },
      { name: "الخامة", displayType: "button", values: ["خشب", "مخمل", "قماش", "جلد", "معدن"] }
    ],
    sizes: ["صغير", "متوسط", "كبير", "عائلي"],
    colors: [
      { name: "رمادي", hexCode: "#64748b" },
      { name: "بيج", hexCode: "#d6b48c" },
      { name: "بني", hexCode: "#92400e" },
      { name: "أسود", hexCode: "#111827" },
      { name: "طبيعي", hexCode: "#c08457" }
    ]
  },
  {
    key: "beauty",
    title: "جمال / عطور وعناية",
    categories: ["عطور", "عناية بالبشرة", "مكياج", "عناية بالشعر", "هدايا وتشكيلات"],
    units: [{ name: "عبوة", symbol: "حسب الحجم" }, { name: "طقم", symbol: "مجموعة" }, { name: "قطعة", symbol: "1 قطعة" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["30ml", "50ml", "100ml", "طقم"] },
      { name: "الفئة", displayType: "button", values: ["رجالي", "نسائي", "يونيسكس", "أطفال"] },
      { name: "الرائحة", displayType: "button", values: ["خشبي", "زهري", "حمضي", "عنبر", "مسك"] }
    ],
    sizes: ["30ml", "50ml", "100ml", "طقم"],
    colors: [
      { name: "ذهبي", hexCode: "#d4af37" },
      { name: "وردي", hexCode: "#ec4899" },
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "أسود", hexCode: "#111827" }
    ]
  },
  {
    key: "grocery",
    title: "بقالة / سوبرماركت",
    categories: ["مواد غذائية", "مشروبات", "خضار وفواكه", "منظفات", "عروض يومية"],
    units: [{ name: "حبة", symbol: "1" }, { name: "كيلو", symbol: "1kg" }, { name: "كرتون", symbol: "حسب المنتج" }, { name: "عبوة", symbol: "حسب الحجم" }],
    attributes: [
      { name: "الوزن", displayType: "button", values: ["250 جم", "500 جم", "1 كيلو", "5 كيلو"] },
      { name: "العبوة", displayType: "button", values: ["حبة", "كيس", "كرتون", "باكت"] },
      { name: "الحالة", displayType: "button", values: ["طازج", "مبرد", "مجمد"] }
    ]
  },
  {
    key: "food-supplies",
    title: "مواد غذائية وتموين",
    categories: ["الأرز والحبوب", "الزيوت والسمن", "المعلبات", "البقوليات", "السكر والطحين", "التوابل والبهارات", "عروض التموين"],
    units: [{ name: "كيلو", symbol: "1kg" }, { name: "كيس", symbol: "حسب الوزن" }, { name: "كرتون", symbol: "جملة" }, { name: "عبوة", symbol: "حسب الحجم" }, { name: "باكت", symbol: "مجموعة" }],
    attributes: [
      { name: "الوزن", displayType: "button", values: ["250 جم", "500 جم", "1 كيلو", "5 كيلو", "10 كيلو", "25 كيلو"] },
      { name: "العبوة", displayType: "button", values: ["حبة", "كيس", "علبة", "كرتون", "باكت"] },
      { name: "نوع البيع", displayType: "button", values: ["قطاعي", "جملة", "عرض عائلي"] }
    ],
    sizes: ["250 جم", "500 جم", "1 كيلو", "5 كيلو", "10 كيلو", "25 كيلو"],
    colors: [
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "ذهبي", hexCode: "#d4af37" },
      { name: "بني", hexCode: "#92400e" },
      { name: "أخضر", hexCode: "#16a34a" }
    ]
  },
  {
    key: "produce",
    title: "خضار وفواكه",
    categories: ["خضروات", "فواكه", "ورقيات", "تمور", "عصائر طازجة", "سلال فواكه"],
    units: [{ name: "كيلو", symbol: "1kg" }, { name: "حبة", symbol: "1" }, { name: "سلة", symbol: "مجموعة" }, { name: "ربطة", symbol: "حسب الصنف" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["صغير", "متوسط", "كبير", "فاخر"] },
      { name: "الحالة", displayType: "button", values: ["طازج", "مبرد", "عضوي", "مستورد"] },
      { name: "التعبئة", displayType: "button", values: ["حبة", "كيلو", "سلة", "كرتون"] }
    ],
    sizes: ["صغير", "متوسط", "كبير", "فاخر"],
    colors: [
      { name: "أخضر", hexCode: "#16a34a" },
      { name: "أحمر", hexCode: "#dc2626" },
      { name: "أصفر", hexCode: "#facc15" },
      { name: "برتقالي", hexCode: "#f97316" }
    ]
  },
  {
    key: "bakery",
    title: "مخبز / حلويات",
    categories: ["خبز", "معجنات", "كيك", "حلويات شرقية", "حلويات غربية", "طلبات مناسبات"],
    units: [{ name: "حبة", symbol: "1" }, { name: "علبة", symbol: "حسب الحجم" }, { name: "كيلو", symbol: "1kg" }, { name: "صينية", symbol: "حسب الحجم" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["صغير", "وسط", "كبير", "عائلي"] },
      { name: "النكهة", displayType: "button", values: ["شوكولاتة", "فانيلا", "فراولة", "تمر", "جبن"] },
      { name: "التعبئة", displayType: "button", values: ["حبة", "علبة", "كيلو", "صينية"] }
    ],
    sizes: ["صغير", "وسط", "كبير", "عائلي"],
    colors: [
      { name: "بني", hexCode: "#92400e" },
      { name: "ذهبي", hexCode: "#d4af37" },
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "وردي", hexCode: "#ec4899" }
    ]
  },
  {
    key: "meat-fish",
    title: "لحوم / دواجن / أسماك",
    categories: ["لحوم حمراء", "دواجن", "أسماك", "مفروم", "مشويات جاهزة", "منتجات مجمدة"],
    units: [{ name: "كيلو", symbol: "1kg" }, { name: "نصف كيلو", symbol: "500g" }, { name: "حبة", symbol: "1" }, { name: "كرتون", symbol: "جملة" }],
    attributes: [
      { name: "الوزن", displayType: "button", values: ["500 جم", "1 كيلو", "2 كيلو", "5 كيلو"] },
      { name: "التقطيع", displayType: "button", values: ["كامل", "شرائح", "مكعبات", "مفروم"] },
      { name: "الحالة", displayType: "button", values: ["طازج", "مبرد", "مجمد", "متبل"] }
    ],
    sizes: ["500 جم", "1 كيلو", "2 كيلو", "5 كيلو"],
    colors: [
      { name: "أحمر", hexCode: "#dc2626" },
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "فضي", hexCode: "#94a3b8" }
    ]
  },
  {
    key: "dairy",
    title: "ألبان وأجبان",
    categories: ["حليب", "زبادي", "أجبان", "لبنة", "زبدة وقشطة", "منتجات مبردة"],
    units: [{ name: "عبوة", symbol: "حسب الحجم" }, { name: "كيلو", symbol: "1kg" }, { name: "كرتون", symbol: "جملة" }, { name: "علبة", symbol: "1" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["200ml", "500ml", "1 لتر", "2 لتر", "1 كيلو"] },
      { name: "الدسم", displayType: "button", values: ["كامل الدسم", "قليل الدسم", "خالي الدسم"] },
      { name: "الحالة", displayType: "button", values: ["طازج", "مبرد", "طويل الأجل"] }
    ],
    sizes: ["200ml", "500ml", "1 لتر", "2 لتر", "1 كيلو"],
    colors: [
      { name: "أبيض", hexCode: "#ffffff" },
      { name: "أزرق", hexCode: "#2563eb" },
      { name: "أخضر", hexCode: "#16a34a" }
    ]
  },
  {
    key: "beverages",
    title: "مشروبات ومياه",
    categories: ["مياه", "عصائر", "مشروبات غازية", "مشروبات طاقة", "قهوة وشاي", "مشروبات صحية"],
    units: [{ name: "عبوة", symbol: "حسب الحجم" }, { name: "كرتون", symbol: "جملة" }, { name: "باكت", symbol: "مجموعة" }, { name: "كوب", symbol: "للتحضير" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["250ml", "330ml", "500ml", "1 لتر", "1.5 لتر"] },
      { name: "النكهة", displayType: "button", values: ["طبيعي", "برتقال", "تفاح", "ليمون", "كولا"] },
      { name: "التعبئة", displayType: "button", values: ["عبوة", "باكت", "كرتون"] }
    ],
    sizes: ["250ml", "330ml", "500ml", "1 لتر", "1.5 لتر"],
    colors: [
      { name: "أزرق", hexCode: "#2563eb" },
      { name: "برتقالي", hexCode: "#f97316" },
      { name: "أخضر", hexCode: "#16a34a" },
      { name: "أحمر", hexCode: "#dc2626" }
    ]
  },
  {
    key: "electronics",
    title: "إلكترونيات / جوالات",
    categories: ["جوالات", "لابتوبات", "شاشات", "إكسسوارات", "قطع غيار"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "علبة", symbol: "1 علبة" }],
    attributes: [
      { name: "اللون", displayType: "color", values: ["أسود", "أبيض", "فضي", "ذهبي"] },
      { name: "السعة", displayType: "button", values: ["64GB", "128GB", "256GB", "512GB"] },
      { name: "الضمان", displayType: "button", values: ["بدون", "6 أشهر", "سنة"] }
    ]
  },
  {
    key: "pharmacy",
    title: "صيدلية / عناية صحية",
    categories: ["أدوية", "عناية شخصية", "مستلزمات طبية", "فيتامينات", "أم وطفل"],
    units: [{ name: "علبة", symbol: "1 علبة" }, { name: "شريط", symbol: "حسب الدواء" }, { name: "عبوة", symbol: "ml/g" }],
    attributes: [
      { name: "الحجم", displayType: "button", values: ["صغير", "وسط", "كبير"] },
      { name: "التركيز", displayType: "button", values: ["منخفض", "متوسط", "مرتفع"] },
      { name: "الفئة", displayType: "button", values: ["رجال", "نساء", "أطفال"] }
    ]
  },
  {
    key: "services",
    title: "خدمات / حجوزات",
    categories: ["خدمات أساسية", "باقات", "استشارات", "صيانة"],
    units: [{ name: "خدمة", symbol: "مرة واحدة" }, { name: "ساعة", symbol: "60 دقيقة" }, { name: "باقة", symbol: "حسب العرض" }],
    attributes: [
      { name: "مدة الخدمة", displayType: "button", values: ["30 دقيقة", "ساعة", "يوم", "شهر"] },
      { name: "مكان التنفيذ", displayType: "button", values: ["داخل المحل", "منزل العميل", "عن بعد"] }
    ]
  }
];


const templateKeywordMap: Record<string, string[]> = {
  restaurant: ["مطعم", "كافيه", "قهوة", "وجبات", "مشروبات", "حلويات"],
  fashion: ["ملابس", "أزياء", "ازياء", "ثياب", "رجالي", "نسائي", "فستان", "قميص", "بنطلون", "جاكيت"],
  shoes: ["أحذية", "احذية", "حذاء", "شوز", "سنيكر", "نعال", "جزم", "رياضي"],
  "home-tools": ["أدوات منزلية", "ادوات منزليه", "منزل", "مطبخ", "نظافة", "تنظيف", "حمام", "تنظيم", "إضاءة", "الصبري"],
  furniture: ["أثاث", "اثاث", "مفروشات", "كنب", "طاولات", "ديكور", "غرف"],
  beauty: ["جمال", "عطور", "عطر", "مكياج", "بشرة", "عناية", "شعر", "سبا"],
  grocery: ["بقالة", "سوبر", "سوبرماركت", "مواد غذائية", "مواد غذائيه", "خضار", "فواكه", "مشروبات"],
  "food-supplies": ["مواد غذائية", "مواد غذائيه", "تموين", "أرز", "ارز", "حبوب", "زيوت", "سمن", "معلبات", "بهارات", "بقوليات", "طحين"],
  produce: ["خضار", "فواكه", "ورقيات", "تمور", "طازج", "سلة فواكه"],
  bakery: ["مخبز", "خبز", "معجنات", "حلويات", "كيك", "صينية", "حلا"],
  "meat-fish": ["لحوم", "لحم", "دواجن", "دجاج", "أسماك", "اسماك", "سمك", "مفروم", "مشويات"],
  dairy: ["ألبان", "البان", "حليب", "زبادي", "أجبان", "اجبان", "لبنة", "زبدة", "قشطة"],
  beverages: ["مشروبات", "مياه", "عصائر", "غازية", "طاقة", "قهوة", "شاي"],
  electronics: ["إلكترونيات", "الكترونيات", "جوال", "هاتف", "كمبيوتر", "لابتوب", "شاشات", "تقنية", "إكسسوارات"],
  pharmacy: ["صيدلية", "دواء", "أدوية", "صحي", "طبية", "فيتامين"],
  services: ["خدمات", "صيانة", "حجوزات", "استشارات"]
};

function normalizeTemplateText(value: string) {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}

function recommendedTemplateKeys(source: string) {
  const normalized = normalizeTemplateText(source);
  const scored = activityTemplates.map((template) => {
    const keywords = templateKeywordMap[template.key] || [template.title, ...template.categories];
    const score = keywords.reduce((sum, keyword) => normalized.includes(normalizeTemplateText(keyword)) ? sum + 1 : sum, 0);
    return { key: template.key, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored.map((item) => item.key).slice(0, 3);
}

function templateCode(templateKey: string, value: string) {
  return `${templateKey}_${makeAttributeCode(value, 0)}`.slice(0, 110);
}

function makeAttributeCode(value: string, fallbackIndex: number) {
  const latin = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (latin) return latin;
  return `attr_${String(fallbackIndex + 1).padStart(2, "0")}`;
}

function unitLabel(unit: Unit) {
  return unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name;
}

export function ProductTaxonomyForm({
  storeId,
  categories,
  attributes,
  values,
  units,
  sizes,
  colors,
  initialTab = "categories",
  storeContext
}: {
  storeId: string;
  categories: Category[];
  attributes: Attribute[];
  values: AttributeValue[];
  units: Unit[];
  sizes: Size[];
  colors: Color[];
  initialTab?: ProductTaxonomyTab;
  storeContext?: { name?: string | null; description?: string | null; wingName?: string | null };
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProductTaxonomyTab>(initialTab);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valuesByAttribute = useMemo(() => {
    const map = new Map<string, AttributeValue[]>();
    for (const value of values) map.set(value.attributeId, [...(map.get(value.attributeId) || []), value]);
    return map;
  }, [values]);

  const recommendedKeys = useMemo(() => recommendedTemplateKeys([
    storeContext?.name || "",
    storeContext?.description || "",
    storeContext?.wingName || "",
    categories.map((category) => category.name).join(" ")
  ].join(" ")), [storeContext, categories]);
  const recommendedTemplates = activityTemplates.filter((template) => recommendedKeys.includes(template.key));

  async function post(url: string, payload: Record<string, unknown>, form?: HTMLFormElement) {
    setLoading(true);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || json.message || "تم الحفظ"}` : json.message || "تعذر الحفظ");
    if (response.ok) { form?.reset(); router.refresh(); }
    return response.ok;
  }

  async function remove(url: string, message = "هل تريد حذف/تعطيل هذا العنصر؟") {
    if (!window.confirm(message)) return;
    setLoading(true);
    const response = await fetch(url, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم التعطيل" : json.message || "تعذر التعطيل");
    if (response.ok) router.refresh();
  }

  async function quickEdit(url: string, currentValue: string, field = "name") {
    const next = window.prompt("اكتب القيمة الجديدة", currentValue);
    if (next === null || !next.trim()) return;
    setLoading(true);
    const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: next.trim() }) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم التعديل" : json.message || "تعذر التعديل");
    if (response.ok) router.refresh();
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await post("/api/merchant/product-taxonomy", { storeId, kind: "category", name: f.get("name"), parentId: f.get("parentId") || null, codeMode: f.get("codeMode"), code: f.get("code") || undefined, imageUrl: f.get("imageUrl") || "" }, event.currentTarget);
  }

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await post("/api/merchant/store-settings", { storeId, kind: "unit", name: f.get("name"), symbol: f.get("symbol") || undefined, isActive: true }, event.currentTarget);
  }

  async function addPresetUnits() {
    setLoading(true);
    const results = await Promise.all(presetUnits.map((unit) => fetch("/api/merchant/store-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "unit", ...unit, isActive: true }) })));
    const okCount = results.filter((response) => response.ok).length;
    setLoading(false);
    setMessage(okCount ? `✓ تم تجهيز ${okCount} وحدة شائعة. يمكنك تعديلها حسب نشاطك.` : "لم يتم تجهيز الوحدات؛ قد تكون موجودة مسبقاً أو حدث خطأ.");
    router.refresh();
  }

  async function addAttribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") || "").trim();
    const code = String(f.get("code") || "").trim() || makeAttributeCode(name, attributes.length);
    await post("/api/merchant/product-taxonomy", { storeId, kind: "attribute", name, code, displayType: f.get("displayType"), isVariantOption: true, isRequired: f.get("isRequired") === "on" }, event.currentTarget);
  }

  async function addValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await post("/api/merchant/product-taxonomy", { storeId, kind: "attributeValue", attributeId: f.get("attributeId"), value: f.get("value"), code: f.get("code") || undefined, colorHex: f.get("colorHex") || undefined, imageUrl: f.get("imageUrl") || "" }, event.currentTarget);
  }

  async function applyActivityTemplate(templateKey: string) {
    const template = activityTemplates.find((item) => item.key === templateKey);
    if (!template) return;
    if (!window.confirm(`سيتم تجهيز قالب ${template.title} بإضافة أقسام ووحدات وخصائص شائعة. يمكنك تعديلها أو تعطيلها لاحقاً. هل تريد المتابعة؟`)) return;
    setLoading(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const category of template.categories) {
        const response = await fetch("/api/merchant/product-taxonomy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "category", name: category, codeMode: "auto", isActive: true }) });
        response.ok ? okCount++ : failCount++;
      }
      for (const unit of template.units) {
        const response = await fetch("/api/merchant/store-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "unit", ...unit, isActive: true }) });
        response.ok ? okCount++ : failCount++;
      }
      for (let index = 0; index < (template.sizes || []).length; index++) {
        const response = await fetch("/api/merchant/store-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "size", name: template.sizes![index], sortOrder: index, isActive: true }) });
        response.ok ? okCount++ : failCount++;
      }
      for (let index = 0; index < (template.colors || []).length; index++) {
        const color = template.colors![index];
        const response = await fetch("/api/merchant/store-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "color", name: color.name, hexCode: color.hexCode, sortOrder: index, isActive: true }) });
        response.ok ? okCount++ : failCount++;
      }
      for (const attribute of template.attributes) {
        const attrResponse = await fetch("/api/merchant/product-taxonomy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "attribute", name: attribute.name, code: templateCode(template.key, attribute.name), displayType: attribute.displayType, isVariantOption: true, isRequired: false, sortOrder: 0, isActive: true }) });
        const attrJson = await attrResponse.json().catch(() => ({}));
        const attrId = attrJson.data?.item?.id;
        attrResponse.ok ? okCount++ : failCount++;
        if (!attrId) continue;
        for (const value of attribute.values) {
          const colorHex = attribute.displayType === "color" ? colorHexForName(value) : undefined;
          const valueResponse = await fetch("/api/merchant/product-taxonomy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, kind: "attributeValue", attributeId: attrId, value, code: makeAttributeCode(value, 0), colorHex, isActive: true }) });
          valueResponse.ok ? okCount++ : failCount++;
        }
      }
      setMessage(`✓ تم تطبيق قالب ${template.title}: ${okCount} عنصر تم حفظه${failCount ? `، ${failCount} عنصر لم يحفظ غالباً لأنه موجود مسبقاً` : ""}.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-5">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-2xl border p-4 text-right transition ${activeTab === tab.id ? "border-primary bg-blue-50 text-primary shadow-card" : "bg-white hover:bg-slate-50"}`}>
            <span className="block font-black">{tab.label}</span>
            <span className="mt-1 block text-xs font-bold text-slate-400">{tab.description}</span>
          </button>
        ))}
      </div>

      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}

      {recommendedTemplates.length ? (
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-emerald-950">اقتراحات ذكية مناسبة لنشاط متجرك</h2>
              <p className="mt-1 text-xs font-bold leading-6 text-emerald-800">اعتمدنا بيانات المقاسات والألوان والأقسام التي جهزناها للمتاجر المشابهة. اضغط القالب المناسب ليتم إنشاء الأقسام والوحدات والمتغيرات وقيمها تلقائياً.</p>
            </div>
            <Badge className="bg-emerald-600 text-white">موصى به</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {recommendedTemplates.map((template) => <button key={template.key} type="button" disabled={loading} onClick={() => applyActivityTemplate(template.key)} className="rounded-2xl border border-emerald-200 bg-white p-4 text-right transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-card"><span className="block font-black text-slate-950">{template.title}</span><span className="mt-1 block text-[11px] font-bold text-slate-500">{template.categories.length} أقسام • {template.units.length} وحدات • {template.attributes.length} متغيرات • {(template.sizes?.length || 0)} مقاسات • {(template.colors?.length || 0)} ألوان</span></button>)}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">قوالب تهيئة ذكية حسب النشاط</h2>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-500">هذه القوالب تجعل الشاشة مناسبة لمعظم التجار: ملابس، أحذية، أدوات منزلية، أثاث، جمال، مطاعم، بقالة، إلكترونيات، صيدليات وخدمات. كل عنصر قابل للتعديل أو التعطيل بعد إضافته.</p>
          </div>
          <Badge variant="outline">اختياري — لا يفرض شيئاً على التاجر</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {activityTemplates.map((template) => <button key={template.key} type="button" disabled={loading} onClick={() => applyActivityTemplate(template.key)} className="rounded-2xl border bg-slate-50 p-4 text-right transition hover:border-blue-200 hover:bg-blue-50"><span className="block font-black text-slate-950">{template.title}</span><span className="mt-1 block text-[11px] font-bold text-slate-500">{template.categories.length} أقسام • {template.attributes.length} خصائص • {(template.sizes?.length || 0)} مقاسات • {(template.colors?.length || 0)} ألوان</span></button>)}
        </div>
      </section>

      {activeTab === "categories" ? (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={addCategory} className="rounded-3xl border bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-black">إضافة مجموعة / قسم</h2>
            <p className="mb-4 text-xs font-bold leading-6 text-slate-500">القسم إلزامي قبل حفظ المنتج حتى لا يظهر صنف بلا تصنيف.</p>
            <div className="space-y-4">
              <Field label="الاسم" name="name" required />
              <Select label="القسم الأب" name="parentId" placeholder="مجموعة رئيسية" items={categories.map((c) => ({ id: c.id, label: `${"—".repeat(c.level)} ${c.code || ""} ${c.name}` }))} />
              <div className="space-y-2"><Label>نظام الكود</Label><select name="codeMode" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="auto">ترقيم تلقائي</option><option value="manual">كود يدوي</option></select></div>
              <Field label="الكود اليدوي" name="code" placeholder="اختياري عند اختيار الكود اليدوي" />
              <MediaUrlInput label="صورة القسم: رابط أو رفع" name="imageUrl" storeId={storeId} folder={`stores/${storeId}/categories`} accept="image/*" />
              <Button disabled={loading} className="w-full">حفظ القسم</Button>
            </div>
          </form>
          <Panel title="شجرة المجموعات المفتوحة">
            <div className="grid gap-2 md:grid-cols-2">{categories.map((c) => <Row key={c.id} title={`${c.code || "-"} ${"—".repeat(c.level)} ${c.name}`} meta={c.parentId ? "قسم فرعي" : "مجموعة رئيسية"} active={c.isActive} onEdit={() => quickEdit(`/api/merchant/product-taxonomy/${c.id}?kind=category`, c.name)} onDelete={() => remove(`/api/merchant/product-taxonomy/${c.id}?kind=category`)} />)}</div>
          </Panel>
        </div>
      ) : null}

      {activeTab === "units" ? (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={addUnit} className="rounded-3xl border bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-black">إضافة وحدة بيع</h2>
            <p className="mb-4 text-xs font-bold leading-6 text-slate-500">الوحدة تظهر في بطاقة المنتج وفي كل تركيبة. اكتب محتوى الوحدة حتى يكون واضحاً: كرتون = 20 حبة، درزن = 12 حبة.</p>
            <div className="space-y-4">
              <Field label="اسم الوحدة" name="name" placeholder="حبة / كيس / كرتون / درزن" required />
              <Field label="محتوى الوحدة / الرمز" name="symbol" placeholder="مثلاً: 20 حبة أو 12 حبة" />
              <Button disabled={loading} className="w-full">حفظ الوحدة</Button>
              <Button type="button" disabled={loading} variant="outline" className="w-full" onClick={addPresetUnits}>تجهيز وحدات شائعة: حبة، كيس، كرتون، درزن</Button>
            </div>
          </form>
          <Panel title="الوحدات الحالية">
            {!units.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد وحدات بعد. أضف حبة أو كيس أو كرتون قبل إضافة المنتجات.</p> : <div className="grid gap-3 md:grid-cols-2">{units.map((unit) => <div key={unit.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">{unitLabel(unit)}</h3><p className="mt-1 text-xs text-slate-500">تظهر كوحدة بيع في بطاقة المنتج والتركيبات</p></div><Badge variant={unit.isActive ? "success" : "outline"}>{unit.isActive ? "نشطة" : "معطلة"}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => quickEdit(`/api/merchant/store-settings/units/${unit.id}`, unit.name, "name")}>تعديل الاسم</Button><Button type="button" size="sm" variant="outline" onClick={() => quickEdit(`/api/merchant/store-settings/units/${unit.id}`, unit.symbol || "", "symbol")}>تعديل المحتوى</Button><Button type="button" size="sm" variant="destructive" onClick={() => remove(`/api/merchant/store-settings/units/${unit.id}`)}>تعطيل</Button></div></div>)}</div>}
          </Panel>
        </div>
      ) : null}

      {activeTab === "attributes" ? (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={addAttribute} className="rounded-3xl border bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-black">إضافة متغير</h2>
            <p className="mb-4 text-xs font-bold leading-6 text-slate-500">المتغير هو القائمة الأولى داخل بطاقة المنتج: مثل العبوة، اللون، المقاس، الطعم. لا تضع كل شيء في بطاقة المنتج؛ أضف المتغير هنا ثم أضف قيمه في التبويب التالي.</p>
            <div className="space-y-4">
              <Field label="اسم المتغير" name="name" placeholder="العبوة / اللون / المقاس" required />
              <Field label="الكود" name="code" placeholder="اختياري؛ إن تركته فارغاً يتم توليده" />
              <div className="space-y-2"><Label>طريقة العرض</Label><select name="displayType" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="button">أزرار</option><option value="color">دوائر لون</option><option value="dropdown">قائمة</option><option value="radio">اختيار</option><option value="text">نص</option></select></div>
              <label className="flex items-center gap-2 text-sm font-bold"><input name="isRequired" type="checkbox" /> متغير إلزامي للمنتج</label>
              <Button disabled={loading} className="w-full">حفظ المتغير</Button>
            </div>
          </form>
          <Panel title="المتغيرات الحالية">
            <div className="grid gap-3 md:grid-cols-2">{attributes.map((a) => <Row key={a.id} title={a.name} meta={`${a.code} — ${a.displayType}${a.isRequired ? " — إلزامي" : ""}`} active={a.isActive} onEdit={() => quickEdit(`/api/merchant/product-taxonomy/${a.id}?kind=attribute`, a.name)} onDelete={() => remove(`/api/merchant/product-taxonomy/${a.id}?kind=attribute`, "تعطيل المتغير سيخفيه من الاختيار وقد يؤثر على منتجات مرتبطة. هل أنت متأكد؟")} />)}</div>
          </Panel>
        </div>
      ) : null}

      {activeTab === "values" ? (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={addValue} className="rounded-3xl border bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-black">إضافة قيمة متغير</h2>
            <p className="mb-4 text-xs font-bold leading-6 text-slate-500">اختر المتغير أولاً، ثم أضف قيمه. مثال: المتغير = العبوة، القيم = كيس، كرتون، درزن.</p>
            <div className="space-y-4">
              <Select label="المتغير" name="attributeId" placeholder="اختر المتغير" required items={attributes.map((a) => ({ id: a.id, label: a.name }))} />
              <Field label="القيمة" name="value" placeholder="كيس / كرتون / درزن / أحمر / كبير" required />
              <Field label="الكود" name="code" placeholder="اختياري" />
              <Field label="لون HEX" name="colorHex" type="color" />
              <MediaUrlInput label="صورة مرتبطة بالقيمة: رابط أو رفع" name="imageUrl" storeId={storeId} folder={`stores/${storeId}/attribute-values`} accept="image/*" />
              <Button disabled={loading} className="w-full">حفظ القيمة</Button>
            </div>
          </form>
          <Panel title="قيم المتغيرات مرتبة حسب المتغير">
            <div className="space-y-5">{attributes.map((attr) => <div key={attr.id} className="rounded-2xl border bg-slate-50 p-4"><h3 className="mb-2 font-black">{attr.name}</h3><div className="flex flex-wrap gap-2">{(valuesByAttribute.get(attr.id) || []).length ? (valuesByAttribute.get(attr.id) || []).map((value) => <span key={value.id} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-bold">{value.colorHex ? <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: value.colorHex }} /> : null}{value.value}<button type="button" onClick={() => quickEdit(`/api/merchant/product-taxonomy/${value.id}?kind=value`, value.value, "value")} className="text-primary">تعديل</button><button type="button" onClick={() => remove(`/api/merchant/product-taxonomy/${value.id}?kind=value`)} className="text-red-500">×</button></span>) : <span className="text-xs font-bold text-slate-400">لا توجد قيم</span>}</div></div>)}</div>
          </Panel>
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <div className="grid gap-5 md:grid-cols-3">
          <Summary title="المجموعات" value={categories.length} />
          <Summary title="الوحدات" value={units.length} />
          <Summary title="المتغيرات" value={attributes.length} />
          <Summary title="قيم المتغيرات" value={values.length} />
          <Summary title="المقاسات" value={sizes.length} />
          <Summary title="الألوان" value={colors.length} />
          <div className="rounded-3xl border bg-white p-6 shadow-card md:col-span-3"><h3 className="font-black">طريقة العمل الجديدة</h3><ol className="mt-3 list-decimal space-y-2 pr-5 text-sm font-bold leading-7 text-slate-600"><li>أضف الأقسام.</li><li>أضف الوحدات: حبة، كيس، كرتون (20 حبة)، درزن (12 حبة).</li><li>أضف المتغيرات: العبوة، اللون، المقاس.</li><li>أضف قيم كل متغير.</li><li>في بطاقة المنتج اختر المتغير من قائمة ثم قيمه من قائمة منفصلة، ثم ولّد التركيبات.</li></ol></div>
        </div>
      ) : null}
    </div>
  );
}

function colorHexForName(value: string) {
  const normalized = value.toLowerCase().replace(/[أإآ]/g, "ا");
  if (normalized.includes("اسود")) return "#111827";
  if (normalized.includes("ابيض")) return "#ffffff";
  if (normalized.includes("احمر")) return "#ef4444";
  if (normalized.includes("برتقالي")) return "#f97316";
  if (normalized.includes("ازرق")) return "#3b82f6";
  if (normalized.includes("بيج")) return "#d6c2a3";
  if (normalized.includes("بني")) return "#92400e";
  if (normalized.includes("وردي")) return "#ec4899";
  if (normalized.includes("اصفر")) return "#facc15";
  if (normalized.includes("اخضر")) return "#16a34a";
  if (normalized.includes("نيلي")) return "#4f46e5";
  if (normalized.includes("طبيعي")) return "#c08457";
  if (normalized.includes("فضي")) return "#cbd5e1";
  if (normalized.includes("ذهبي")) return "#fbbf24";
  return "#94a3b8";
}
function Summary({ title, value }: { title: string; value: number }) { return <div className="rounded-3xl border bg-white p-6 text-center shadow-card"><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 text-4xl font-black text-primary">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: ReactNode }) { return <div className="rounded-3xl border bg-white p-5 shadow-card"><h2 className="mb-4 text-lg font-black">{title}</h2>{children}</div>; }
function Row({ title, meta, active, onEdit, onDelete }: { title: string; meta: string; active: boolean; onEdit?: () => void; onDelete: () => void }) { return <div className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">{title}</h3><p className="mt-1 text-xs text-slate-500">{meta}</p></div><Badge variant={active ? "success" : "outline"}>{active ? "نشط" : "معطل"}</Badge></div><div className="mt-3 flex gap-2">{onEdit ? <Button type="button" size="sm" variant="outline" onClick={onEdit}>تعديل</Button> : null}<Button type="button" size="sm" variant="destructive" onClick={onDelete}>تعطيل</Button></div></div>; }
function Select({ label, name, items, placeholder, required = false }: { label: string; name: string; items: Array<{ id: string; label: string }>; placeholder: string; required?: boolean }) { return <div className="space-y-2"><Label>{label}</Label><select name={name} required={required} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">{placeholder}</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>; }
function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder || ""} /></div>; }
