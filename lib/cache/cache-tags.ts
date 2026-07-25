const VERSION = "v1";

function part(value: string) {
  return encodeURIComponent(value.trim().toLowerCase()).slice(0, 120);
}

export const PUBLIC_CACHE_TTL = {
  home: 120,
  store: 300,
  product: 300,
  wings: 300,
  wing: 600,
  offers: 120,
  settings: 300
} as const;

export const PUBLIC_CACHE_TAGS = {
  home: "public:home",
  stores: "public:stores",
  products: "public:products",
  wings: "public:wings",
  offers: "public:offers",
  settings: "public:settings",
  storeSlug: (slug: string) => `public:store:${part(slug)}`,
  productSlug: (storeSlug: string, productSlug: string) => `public:product:${part(storeSlug)}:${part(productSlug)}`,
  wingSlug: (slug: string) => `public:wing:${part(slug)}`
} as const;

export const PUBLIC_CACHE_KEYS = {
  home: (timeBucket = "static") => `public:${VERSION}:home:${part(timeBucket)}`,
  storePage: (slug: string) => `public:${VERSION}:store:${part(slug)}`,
  productPage: (storeSlug: string, productSlug: string) => `public:${VERSION}:product:${part(storeSlug)}:${part(productSlug)}`,
  productDiscovery: (productId: string) => `public:${VERSION}:product-discovery:${part(productId)}`,
  productComparison: (productIds: string[]) => `public:${VERSION}:product-comparison:${productIds.map(part).sort().join(":")}`,
  wingPage: (slug: string) => `public:${VERSION}:wing:${part(slug)}`,
  offersPage: () => `public:${VERSION}:offers`
} as const;
