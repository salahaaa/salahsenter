# Architecture

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Drizzle ORM
- PostgreSQL
- JWT + HTTP-only session cookie
- RBAC + store scoped roles
- Audit logs and security alerts

## Layers
```txt
app/                  Routes, pages, API handlers
components/           UI and client components
lib/auth.ts           Authentication/session helpers
lib/rbac.ts           Role and permission checks
lib/db/schema.ts      Drizzle schema source of truth
lib/smart-search.ts   Unified smart search and shopping assistant intent engine
lib/media.ts          Hardened upload pipeline
middleware.ts         Security headers, CSRF, auth route gates
```

## Security Boundaries
- `/admin/*` requires `super_admin`.
- `/merchant/*` requires merchant/store role or super admin.
- Store operations must verify store ownership/employee access.
- Mutating APIs require same-origin request and CSRF token.

## Production Notes
The schema is still exported from `lib/db/schema.ts` for migration stability. A future refactor can move domains into `lib/db/schema/*.ts` after a dedicated migration freeze window.
