type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

function safeJson(value: JsonLd) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** Server-safe JSON-LD emitter. Values are escaped to avoid script injection. */
export function StructuredData({ data }: { data: JsonLd }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(data) }} />;
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })) };
}
