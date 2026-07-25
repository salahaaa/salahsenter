export type ActivityTemplate = {
  key: string;
  title: string;
  description?: string;
  notice?: string;
  categories: string[];
  units: Array<{ name: string; symbol?: string }>;
  attributes: Array<{ name: string; displayType: string; values: string[] }>;
  sizes?: string[];
  colors?: Array<{ name: string; hexCode: string }>;
  starterProducts?: Array<{ name: string; category: string; description?: string; attributes?: Record<string, string> }>;
};

export const activityTemplates: ActivityTemplate[] = [
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
    key: "hardware-building",
    title: "مواد بناء / أدوات ومعدات",
    description: "تصنيفات ووحدات مناسبة للعدد والدهانات والسباكة والكهرباء ومواد البناء.",
    categories: ["أدوات يدوية", "كهربائيات", "سباكة", "دهانات", "مواد بناء", "سلامة ومعدات"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "متر", symbol: "1m" }, { name: "كيلو", symbol: "1kg" }, { name: "كرتون", symbol: "جملة" }],
    attributes: [
      { name: "المادة", displayType: "button", values: ["حديد", "بلاستيك", "نحاس", "خشب", "ستانلس"] },
      { name: "المقاس", displayType: "button", values: ["صغير", "متوسط", "كبير", "حسب القياس"] },
      { name: "اللون", displayType: "color", values: ["أبيض", "أسود", "رمادي", "أحمر", "أزرق"] }
    ],
    sizes: ["صغير", "متوسط", "كبير", "حسب القياس"],
    colors: [{ name: "أبيض", hexCode: "#ffffff" }, { name: "أسود", hexCode: "#111827" }, { name: "رمادي", hexCode: "#64748b" }, { name: "أحمر", hexCode: "#dc2626" }]
  },
  {
    key: "auto-parts",
    title: "قطع غيار وزينة سيارات",
    description: "بنية مخصصة لقطع الغيار والزيوت والإطارات والإكسسوارات.",
    categories: ["قطع غيار", "زيوت وسوائل", "إطارات", "كهرباء سيارات", "زينة وإكسسوارات", "أدوات صيانة"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "علبة", symbol: "1 علبة" }, { name: "لتر", symbol: "1L" }, { name: "طقم", symbol: "مجموعة" }],
    attributes: [
      { name: "نوع المركبة", displayType: "button", values: ["سيدان", "دفع رباعي", "شاحنة", "دراجة"] },
      { name: "الموديل", displayType: "button", values: ["عام", "حسب السيارة", "أصلي", "بديل"] },
      { name: "المنشأ", displayType: "button", values: ["ياباني", "كوري", "أمريكي", "صيني"] }
    ]
  },
  {
    key: "books-stationery",
    title: "كتب / قرطاسية ومكتبية",
    description: "قالب للكتب والدفاتر والأدوات التعليمية والمكتبية.",
    categories: ["كتب", "دفاتر", "أقلام", "أدوات هندسية", "طباعة وتغليف", "مستلزمات مدرسية"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "رزمة", symbol: "مجموعة" }, { name: "كرتون", symbol: "جملة" }],
    attributes: [
      { name: "اللغة", displayType: "button", values: ["عربي", "إنجليزي", "ثنائي اللغة"] },
      { name: "المستوى", displayType: "button", values: ["أطفال", "مدرسي", "جامعي", "عام"] },
      { name: "اللون", displayType: "color", values: ["أزرق", "أحمر", "أسود", "أخضر", "وردي"] }
    ],
    colors: [{ name: "أزرق", hexCode: "#2563eb" }, { name: "أحمر", hexCode: "#dc2626" }, { name: "أسود", hexCode: "#111827" }, { name: "أخضر", hexCode: "#16a34a" }]
  },
  {
    key: "baby-kids",
    title: "أطفال / ألعاب ومستلزمات",
    description: "قالب لملابس الأطفال والألعاب والعناية ومستلزمات الأم والطفل.",
    categories: ["ملابس أطفال", "ألعاب", "رضاعة وعناية", "عربات وكراسي", "مستلزمات مدرسية", "هدايا أطفال"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "طقم", symbol: "مجموعة" }, { name: "علبة", symbol: "حسب المنتج" }],
    attributes: [
      { name: "العمر", displayType: "button", values: ["0-6 أشهر", "6-12 شهر", "1-3 سنوات", "4-7 سنوات", "8+ سنوات"] },
      { name: "اللون", displayType: "color", values: ["أزرق", "وردي", "أصفر", "أخضر", "متعدد"] },
      { name: "المادة", displayType: "button", values: ["قطن", "بلاستيك", "خشب", "قماش"] }
    ]
  },
  {
    key: "home-appliances",
    title: "أجهزة منزلية وكهربائية",
    description: "قالب للأجهزة الكبيرة والصغيرة وملحقاتها وقطع غيارها المنزلية.",
    categories: ["أجهزة مطبخ", "غسالات ومجففات", "ثلاجات ومجمدات", "تكييف وتبريد", "مكانس وتنظيف", "قطع غيار وملحقات"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "جهاز", symbol: "1 جهاز" }, { name: "طقم", symbol: "مجموعة" }],
    attributes: [
      { name: "العلامة التجارية", displayType: "button", values: ["محلي", "سامسونج", "LG", "ميديا", "أخرى"] },
      { name: "السعة", displayType: "button", values: ["صغير", "متوسط", "كبير", "عائلي"] },
      { name: "اللون", displayType: "color", values: ["أبيض", "فضي", "أسود", "رمادي"] },
      { name: "الضمان", displayType: "button", values: ["بدون", "6 أشهر", "سنة", "سنتان"] }
    ],
    colors: [{ name: "أبيض", hexCode: "#ffffff" }, { name: "فضي", hexCode: "#94a3b8" }, { name: "أسود", hexCode: "#111827" }, { name: "رمادي", hexCode: "#64748b" }]
  },
  {
    key: "decor-carpets",
    title: "ديكور / سجاد وستائر",
    description: "قالب للمفروشات المنزلية والسجاد والستائر والإضاءة والديكور.",
    categories: ["سجاد", "ستائر", "مفارش", "إضاءة ونجف", "لوحات وديكور", "وسائد وإكسسوارات"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "متر", symbol: "1m" }, { name: "طقم", symbol: "مجموعة" }],
    attributes: [
      { name: "المقاس", displayType: "button", values: ["صغير", "متوسط", "كبير", "حسب القياس"] },
      { name: "الخامة", displayType: "button", values: ["صوف", "قطن", "حرير", "بوليستر", "خشب"] },
      { name: "اللون", displayType: "color", values: ["بيج", "رمادي", "بني", "أبيض", "ذهبي"] }
    ],
    colors: [{ name: "بيج", hexCode: "#d6b48c" }, { name: "رمادي", hexCode: "#64748b" }, { name: "بني", hexCode: "#92400e" }, { name: "ذهبي", hexCode: "#d4af37" }]
  },
  {
    key: "fabrics-sewing",
    title: "أقمشة / خياطة وتفصيل",
    description: "قالب للأقمشة والملابس المفصلة ولوازم الخياطة.",
    categories: ["أقمشة نسائية", "أقمشة رجالية", "أقمشة أطفال", "خيوط ولوازم", "تفصيل وخياطة", "إكسسوارات أقمشة"],
    units: [{ name: "متر", symbol: "1m" }, { name: "ياردة", symbol: "1 yard" }, { name: "قطعة", symbol: "1 قطعة" }, { name: "لفة", symbol: "حسب الطول" }],
    attributes: [
      { name: "الخامة", displayType: "button", values: ["قطن", "حرير", "كتان", "صوف", "جينز", "بوليستر"] },
      { name: "العرض", displayType: "button", values: ["ضيق", "متوسط", "عريض"] },
      { name: "اللون", displayType: "color", values: ["أبيض", "أسود", "أحمر", "أزرق", "بيج", "متعدد"] }
    ]
  },
  {
    key: "mobile-accessories",
    title: "جوالات / ملحقات وصيانة",
    description: "قالب للهواتف والجرابات والشواحن والسماعات وقطع الصيانة.",
    categories: ["جوالات", "جرابات وحماية", "شواحن وكوابل", "سماعات", "قطع صيانة", "ساعات ذكية"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "علبة", symbol: "1 علبة" }, { name: "طقم", symbol: "مجموعة" }],
    attributes: [
      { name: "التوافق", displayType: "button", values: ["عام", "آيفون", "سامسونج", "شاومي", "هواوي"] },
      { name: "اللون", displayType: "color", values: ["أسود", "أبيض", "أزرق", "ذهبي", "شفاف"] },
      { name: "المنفذ", displayType: "button", values: ["USB-C", "Lightning", "Micro USB", "لاسلكي"] }
    ]
  },
  {
    key: "computers-gaming",
    title: "كمبيوتر / ألعاب وملحقات",
    description: "قالب للحواسيب واللابتوبات وملحقات الألعاب والتخزين والشبكات.",
    categories: ["لابتوبات", "كمبيوتر مكتبي", "شاشات", "ألعاب وملحقات", "تخزين وذاكرة", "شبكات وطابعات"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "جهاز", symbol: "1 جهاز" }, { name: "علبة", symbol: "1 علبة" }],
    attributes: [
      { name: "المعالج", displayType: "button", values: ["Intel", "AMD", "Apple", "أخرى"] },
      { name: "الذاكرة", displayType: "button", values: ["4GB", "8GB", "16GB", "32GB", "64GB"] },
      { name: "السعة", displayType: "button", values: ["128GB", "256GB", "512GB", "1TB", "2TB"] },
      { name: "اللون", displayType: "color", values: ["أسود", "فضي", "أبيض", "رمادي"] }
    ]
  },
  {
    key: "jewelry-accessories",
    title: "ذهب / مجوهرات وإكسسوارات",
    description: "قالب للمجوهرات والساعات والإكسسوارات والهدايا الفاخرة.",
    categories: ["ذهب", "فضة", "مجوهرات", "ساعات", "إكسسوارات", "هدايا"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "طقم", symbol: "مجموعة" }, { name: "جرام", symbol: "1g" }],
    attributes: [
      { name: "المادة", displayType: "button", values: ["ذهب", "فضة", "ستانلس", "نحاس", "مطلية"] },
      { name: "العيار", displayType: "button", values: ["18", "21", "22", "24", "غير ذهب"] },
      { name: "اللون", displayType: "color", values: ["ذهبي", "فضي", "وردي", "أسود"] }
    ],
    notice: "الأسعار والأوزان الفعلية يجب أن يراجعها التاجر يدوياً؛ القالب لا يحسب أسعار الذهب أو المصنعية.",
    colors: [{ name: "ذهبي", hexCode: "#d4af37" }, { name: "فضي", hexCode: "#cbd5e1" }, { name: "وردي", hexCode: "#ec4899" }]
  },
  {
    key: "agriculture-irrigation",
    title: "زراعة / ري وبذور",
    description: "قالب للبذور والأسمدة وشبكات الري والأدوات الزراعية.",
    categories: ["بذور", "أسمدة", "مبيدات", "شبكات ري", "أدوات زراعية", "مستلزمات حيوانية"],
    units: [{ name: "كيلو", symbol: "1kg" }, { name: "كيس", symbol: "حسب الوزن" }, { name: "لتر", symbol: "1L" }, { name: "قطعة", symbol: "1 قطعة" }],
    attributes: [
      { name: "الموسم", displayType: "button", values: ["صيفي", "شتوي", "طوال العام"] },
      { name: "الاستخدام", displayType: "button", values: ["زراعي", "منزلي", "تجاري"] },
      { name: "الوزن/السعة", displayType: "button", values: ["250 جم", "500 جم", "1 كيلو", "5 كيلو", "20 لتر"] }
    ],
    notice: "القالب لا يقدم توصية زراعية أو جرعات استخدام؛ يجب إدخال تعليمات المنتج المعتمدة يدوياً."
  },
  {
    key: "wholesale-distribution",
    title: "جملة / توزيع وتجارة عامة",
    description: "قالب للموردين والموزعين والبيع بالجملة متعدد العبوات.",
    categories: ["مواد استهلاكية", "مواد غذائية", "منظفات", "إكسسوارات", "بضائع موسمية", "عروض جملة"],
    units: [{ name: "قطعة", symbol: "1 قطعة" }, { name: "كرتون", symbol: "جملة" }, { name: "باكت", symbol: "مجموعة" }, { name: "باليت", symbol: "حسب الكمية" }],
    attributes: [
      { name: "نوع البيع", displayType: "button", values: ["قطاعي", "جملة", "نصف جملة"] },
      { name: "التعبئة", displayType: "button", values: ["قطعة", "باكت", "كرتون", "باليت"] },
      { name: "المنشأ", displayType: "button", values: ["محلي", "مستورد", "خليجي", "آسيوي"] }
    ]
  },
  {
    key: "pharmacy",
    title: "صيدلية / عناية صحية",
    notice: "القالب ينظم التصنيفات والخصائص فقط؛ لا يفعّل وصفات طبية أو تتبع صلاحية/دفعات تلقائياً.",
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
    notice: "القالب ينظم تصنيفات الخدمات فقط؛ لا ينشئ تقويماً أو نظام حجز تلقائياً.",
    categories: ["خدمات أساسية", "باقات", "استشارات", "صيانة"],
    units: [{ name: "خدمة", symbol: "مرة واحدة" }, { name: "ساعة", symbol: "60 دقيقة" }, { name: "باقة", symbol: "حسب العرض" }],
    attributes: [
      { name: "مدة الخدمة", displayType: "button", values: ["30 دقيقة", "ساعة", "يوم", "شهر"] },
      { name: "مكان التنفيذ", displayType: "button", values: ["داخل المحل", "منزل العميل", "عن بعد"] }
    ]
  }
];


export const templateKeywordMap: Record<string, string[]> = {
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
  "hardware-building": ["مواد بناء", "ادوات", "أدوات", "سباكة", "كهرباء", "دهانات", "حديد", "مقاولات"],
  "auto-parts": ["قطع غيار", "سيارات", "سيارة", "زيوت", "إطارات", "اطارات", "زينة سيارات"],
  "books-stationery": ["قرطاسية", "كتب", "دفاتر", "مدرسية", "أقلام", "اقلام", "مكتبية"],
  "baby-kids": ["أطفال", "اطفال", "ألعاب", "العاب", "رضاعة", "مواليد", "طفل"],
  "home-appliances": ["أجهزة منزلية", "اجهزة منزلية", "غسالات", "ثلاجات", "مكيف", "تكييف", "مكانس"],
  "decor-carpets": ["ديكور", "سجاد", "ستائر", "مفارش", "نجف", "إضاءة"],
  "fabrics-sewing": ["أقمشة", "اقمشة", "خياطة", "تفصيل", "قماش", "أقمشه"],
  "mobile-accessories": ["جوالات", "جوال", "جرابات", "شواحن", "سماعات", "صيانة جوالات"],
  "computers-gaming": ["كمبيوتر", "لابتوب", "ألعاب", "العاب", "بلايستيشن", "شاشات", "طابعات"],
  "jewelry-accessories": ["ذهب", "مجوهرات", "فضة", "ساعات", "إكسسوارات", "اكسسوارات"],
  "agriculture-irrigation": ["زراعة", "بذور", "أسمدة", "اسمدة", "ري", "شبكات ري", "زراعية"],
  "wholesale-distribution": ["جملة", "توزيع", "مورد", "توريد", "تجارة عامة", "كرتون"],
  pharmacy: ["صيدلية", "دواء", "أدوية", "صحي", "طبية", "فيتامين"],
  services: ["خدمات", "صيانة", "حجوزات", "استشارات"]
};
export function normalizeTemplateText(value: string) {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return hash;
}

export function makeActivityTemplateCode(templateKey: string, value: string) {
  const latin = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const code = latin || `attr_${Math.abs(hashCode(value)).toString(36).slice(0, 8)}`;
  return `${templateKey}_${code}`.slice(0, 110);
}

export function recommendedActivityTemplateKeys(source: string) {
  const normalized = normalizeTemplateText(source);
  const scored = activityTemplates.map((template) => {
    const keywords = templateKeywordMap[template.key] || [template.title, ...template.categories];
    const score = keywords.reduce((sum, keyword) => normalized.includes(normalizeTemplateText(keyword)) ? sum + 1 : sum, 0);
    return { key: template.key, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored.map((item) => item.key).slice(0, 4);
}
