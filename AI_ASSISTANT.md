# AI Merchant Assistant

## Overview
Adds an Enterprise merchant AI assistant at:

```txt
/merchant/ai-assistant
/api/merchant/ai-assistant
```

## Capabilities
- Sales, orders, customers, inventory, profit estimate and product analysis.
- Growth recommendations ranked by impact score.
- AI Product Assistant for product name, description, SEO title, meta description, keywords and tags.
- Conversation and AI usage logging.

## Tables
```txt
ai_conversations
ai_recommendations
ai_logs
```

## Architecture
- `lib/enterprise/merchant-ai.ts` is the service layer.
- Uses current marketplace data through existing Drizzle models.
- Uses local deterministic AI heuristics now, and can be upgraded to external LLM providers later.

## Security
- Requires authenticated merchant/store user.
- Store context is derived from `getMerchantPrimaryStore`.
- All mutating calls are CSRF protected by middleware.
- AI logs are scoped to store/user.
