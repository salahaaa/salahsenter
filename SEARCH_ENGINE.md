# Advanced Search Engine

## Engine Choice
Meilisearch is selected as the preferred external search engine because it is lightweight, fast, typo-tolerant, and easy to operate for Arabic/English marketplace search.

## Fallback
If Meilisearch is not configured, the platform uses the built-in PostgreSQL smart search engine:

```txt
lib/smart-search.ts
lib/enterprise/search-engine.ts
/api/search/advanced
```

## Supported Features
- Autocomplete
- Typo tolerance foundation through synonyms and normalization
- Arabic and English normalization
- Synonyms
- Filters
- Sorting
- Faceted search-ready contract
- Instant search
- Search analytics

## Index Targets
```txt
products
stores
categories
merchants
wings
```

## Environment
```env
MEILI_HOST=
MEILI_MASTER_KEY=
```

## Analytics Table
```txt
search_analytics
```

Tracks:
- Query
- Normalized query
- Result count
- Source
- Filters
- Click targets for future conversion analysis
